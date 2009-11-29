var sys = require("sys");
var libxml = require("libxmljs");
var ec2client = require("./ec2client");
var ec2models = require("./ec2models");

libxml.Document.prototype.at = function(name) {
  var selected = [];
  this.find("*").forEach(function(x) { if(x.name() == name) selected.push(x); });
  return selected[0];
};
libxml.Element.prototype.at = libxml.Document.prototype.at;

var ec2api = function (credential) {
  this.client = ec2client.create(this, credential);
};

var regions = []
regions.push(new ec2models.Region("us-east-1", "us-east-1.ec2.amazonaws.com"));
regions.push(new ec2models.Region("eu-west-1", "eu-west-1.ec2.amazonaws.com"));

var findRegion = function(name) {
  var aRegion = null;
  regions.forEach(function(region) {
    if (region.name == name) aRegion = region;
  });
  return aRegion;
};

ec2api.prototype.setRegion = function(name) {
  this.region = findRegion(name);
};

ec2api.prototype.describeAddresses = function (callback) {
  this.client.queryEC2("DescribeAddresses", [], function (value) {
    var doc = libxml.parseString(value.body);
    var items = doc.at("addressesSet").find("*");
    var addresses = [];
    for (var i in items) {
      var item = items[i];
      var address = new ec2models.AddressMapping(
        item.at("publicIp").text(),
        item.at("instanceId").text()
      );
      addresses.push(address);
    }
    callback({addresses: addresses});
  });
};

ec2api.prototype.allocateAddress = function (callback) {
  this.client.queryEC2("AllocateAddress", [], function (value) {
    var doc = libxml.parseString(value.body);
    var address = new ec2models.AddressMapping(doc.at("publicIp").text());
    callback({address: address});
  });
};

ec2api.prototype.releaseAddress = function (address, callback) {
  this.client.queryEC2("ReleaseAddress", [['PublicIp', address]], function (value) {
    var doc = libxml.parseString(value.body);
    var ok = doc.at("return").text();
    callback({ok: ok == "true"});
  });
};

ec2api.prototype.errback = function (value) {
  var doc = libxml.parseString(value.body);
  var errorNode = doc.at("Errors").at("Error");
  sys.puts("error: ");
  sys.puts(errorNode.at("Code").text());
  sys.puts(errorNode.at("Message").text());
};

exports.create = function (accessKeyId, secretAccessKey) {
  var credential = new ec2models.Credential(accessKeyId, secretAccessKey);
  return new ec2api(credential);
};
