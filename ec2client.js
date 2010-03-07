var sys = require("sys");
var http = require("http");
var sha1 = require("./sha1");

var log = function(message) {
  if (process.ENV["LOG"]) sys.puts("log: " + message);
};

var ec2client = function (api, credential) {
  this.api = api;
  this.credential = credential;
  this.USER_AGENT = "NodeEC2-0.0.1";
  this.API_VERSION = "2009-07-15";
  this.VPN_CONFIG_PATH = "http://ec2-downloads.s3.amazonaws.com/";
};

ec2client.prototype.region = function() {
  return this.api.region;
};

ec2client.prototype.queryEC2 = function (action, params, callback) {
  if (this.credential == null) {
      throw "Call setCredential to set the EC2 credentials";
  }

  if (this.region() == null) {
    throw "Call setRegion to set the EC2 region";
  }

  var curTime = new Date();
  var formattedTime = this.formatDate(curTime, "yyyy-MM-ddThh:mm:ssZ");

  var sigValues = new Array();
  sigValues.push(new Array("Action", action));
  sigValues.push(new Array("AWSAccessKeyId", this.credential.accessKeyId));
  sigValues.push(new Array("SignatureVersion","1"));
  sigValues.push(new Array("Version",this.API_VERSION));
  sigValues.push(new Array("Timestamp",formattedTime));

  // Mix in the additional parameters. params must be an Array of tuples as for sigValues above
  for (var i = 0; i < params.length; i++) {
      sigValues.push(params[i]);
  }

  // Sort the parameters by their lowercase name
  sigValues.sort(this.sigParamCmp);

  // Construct the string to sign and query string
  var strSig = "";
  var queryParams = "";
  for (var i = 0; i < sigValues.length; i++) {
      strSig += sigValues[i][0] + sigValues[i][1];
      queryParams += sigValues[i][0] + "=" + encodeURIComponent(sigValues[i][1]);
      if (i < sigValues.length-1)
          queryParams += "&";
  }

  log("StrSig ["+strSig+"]");
  log("Params ["+queryParams+"]");

  var sig = sha1.b64_hmac_sha1(this.credential.secretAccessKey, strSig);
  log("Sig ["+sig+"]");

  queryParams += "&Signature="+encodeURIComponent(sig);
  var url = this.serviceURL() + "/";

  log("URL ["+url+"]");
  log("QueryParams ["+queryParams+"]");

  var timerKey = strSig+":"+formattedTime;

  var headers = {
    "Host": this.region().host,
    "User-Agent": this.USER_AGENT,
    "Content-Type": "application/x-www-form-urlencoded",
    "Content-Length": queryParams.length,
    "Connection": "close"
  };
  var _this = this;
  var client = http.createClient(443, this.region().host);
  client.setSecure("x509_PEM");

  var request = client.request("POST", "/", headers);
  request.addListener('response', function (response) {
    var body = "";
    response.addListener("data", function (chunk) {
      body += chunk;
    });
    response.addListener("end", function () {
      log("complete: statusCode: " + response.statusCode + ", body: " + body);
      var ok = response.statusCode >= 200 && response.statusCode < 300;
      var value = {
        action: action,
        response: response,
        body: body,
        ok: ok
      }
      if (ok) {
        callback(value);
      }
      else {
        _this.api.errback(value);
      }
    });
  });
  request.write(queryParams);
  request.close();

  return true;
};

ec2client.prototype.serviceURL = function() {
  return "https://" + this.region().host;
};

ec2client.prototype.sigParamCmp = function(x, y) {
  if (x[0].toLowerCase() < y[0].toLowerCase ()) {
      return -1;
  }
  if (x[0].toLowerCase() > y[0].toLowerCase()) {
     return 1;
  }
  return 0;
};

ec2client.prototype.addZero = function(vNumber) {
  return ((vNumber < 10) ? "0" : "") + vNumber;
};

ec2client.prototype.formatDate = function(vDate, vFormat) {
  var vDay       = this.addZero(vDate.getUTCDate());
  var vMonth     = this.addZero(vDate.getUTCMonth()+1);
  var vYearLong  = this.addZero(vDate.getUTCFullYear());
  var vYearShort = this.addZero(vDate.getUTCFullYear().toString().substring(3,4));
  var vYear      = (vFormat.indexOf("yyyy")>-1?vYearLong:vYearShort);
  var vHour      = this.addZero(vDate.getUTCHours());
  var vMinute    = this.addZero(vDate.getUTCMinutes());
  var vSecond    = this.addZero(vDate.getUTCSeconds());
  var vDateString= vFormat.replace(/dd/g, vDay).replace(/MM/g, vMonth).replace(/y{1,4}/g, vYear);
  vDateString    = vDateString.replace(/hh/g, vHour).replace(/mm/g, vMinute).replace(/ss/g, vSecond);
  return vDateString;
};

exports.create = function(api, credential) {
  return new ec2client(api, credential);
};
