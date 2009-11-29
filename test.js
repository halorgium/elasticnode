var sys = require("sys");
var ec2api = require("./ec2api");
var config = require("./config").load;

var listAddresses = function (callback) {
  api.describeAddresses(function(response) {
    sys.puts("Your EC2 Elastic IPs are: ");
    response.addresses.forEach(function(address) {
      sys.puts(address.publicIp + ": " + address.instanceId);
    });
    if (callback) callback();
  });
};

var allocateAddress = function (callback) {
  api.allocateAddress(function (response) {
    sys.puts("The new EC2 Elastic IP is: " + response.address.publicIp);
    if (callback) callback(response.address);
  });
};

var releaseAddress = function (address, callback) {
  api.releaseAddress(address.publicIp, function (response) {
    sys.puts("EC2 Elastic IP (" + address.publicIp + ") removed successfully: " + response.ok);
    if (callback) callback(response.ok);
  });
};

var api = ec2api.create(config.accessKeyId, config.secretAccessKey);
api.setRegion("us-east-1");

listAddresses(function () {
  allocateAddress(function (address) {
    listAddresses(function () {
      releaseAddress(address, function () {
        listAddresses(function () {
          sys.puts("Complete");
        });
      });
    });
  });
});
