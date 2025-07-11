function genId() {
  var id = "";
  for (var i = 0; i < 10; i++) id += Math.floor(Math.random() * 9);
  return id;
}
//////////////////////////////////////////////////////////
function getStatus(url, funcvalid, funcinvalid) {
  var xmlhttp;
  if (window.XMLHttpRequest) xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function () {
    if (xmlhttp.readyState == 4) {
      if (xmlhttp.responseText == "valid") funcvalid();
      else funcinvalid();
    }
  };

  try {
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
  } catch (e) {
    funcinvalid();
  }
}
//////////////////////////////////////////////////////////
//A way yo provide the badge across the session
//////////////////////////////////////////////////////////
function getQueryVariable(variable)
{
     var query = window.location.search.substring(1);
     if(query!=""){
      var vars = query.split("&");
        for (var i=0;i<vars.length;i++) {
             var pair = vars[i].split("=");
             if(pair[0] == variable){
              return pair[1];
            }
        }
    }
    return false;
}
var badgeID = getQueryVariable("badgeID");

//////////////////////////////////////////////////////////
function asciihex(str) {
  var text = "";
  if(!str){
    return text;
  }
  for (var i = 0, l = str.length; i < l; i++) {
    var hex = Number(str.charCodeAt(i)).toString(16);
    text += hex;
  }
  return text;
}
//////////////////////////////////////////////////////////
function printFailed() {
  alert("failed to print the barcode!");
}
//////////////////////////////////////////////////////////
function printLabel() {
  var barcode = document.getElementById("barcodedata").value;
  var displayText = document.getElementById("displaytext").value;
  var quant = document.getElementById("quantity").value;
  barcode = barcode.trim();
  printAnylabel(barcode, displayText, "",quant);
}
//////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////
function addPreset() {
  var barcode = document.getElementById("barcodedata").value;
  var displayText = document.getElementById("displaytext").value;
  if(barcode =="" && displayText==""){
    return;
  }
  barcode = barcode.trim();
  pre = document.createElement('a');
  pre.innerHTML = displayText != '' ? displayText : barcode;
  pre.classList.add('apmbutton');
  pre.setAttribute('onClick','printAnylabel("'+(displayText !="" ? displayText : barcode) +'","'+ (barcode != '' ? barcode : displayText) + '","ISS Exception",2);')
  presets = document.getElementById("presets");
  presets.appendChild(pre)
}
//////////////////////////////////////////////////////////

function printAnylabel(b, t, d,n) {
  var badge;
  if(badgeID!=false){
    badge = badgeID;
  }
  else{
    badge= "8008135"
  }
  getStatus(
    
    "http://localhost:5965/printer?action=print&type=barcode&" +
      "data=" +
      encodeURIComponent(asciihex(b)) +
      "&text=" +
      encodeURIComponent(asciihex(t)) +
      "&quantity=" +
      encodeURIComponent(parseInt(n)) +
      "&badgeid=" +
      encodeURIComponent(parseInt(badge)) +
      "&desc=" +
      encodeURIComponent(asciihex(d)) +
      "&seq=" +
      encodeURIComponent(genId()),
    function () {},
    printFailed
  );
}

function printTab() {
  var badge = 1;
  getStatus(
    "http://localhost:5965/printer?action=print&type=barcode&" +
      "data=%09&text=" +
      encodeURIComponent(asciihex("Single Tab")) +
      "&quantity=" +
      encodeURIComponent(1) +
      "&badgeid=" +
      encodeURIComponent(parseInt(1)) +
      "&desc=" +
      encodeURIComponent(asciihex("Single Tab")) +
      "&seq=" +
      encodeURIComponent(genId()),
    function () {},
    printFailed
  );
}

function printDoubleTab() {
  var badge = 1;
  getStatus(
    "http://localhost:5965/printer?action=print&type=barcode&" +
      "data=0909&text=" +
      encodeURIComponent(asciihex("Double Tab")) +
      "&quantity=" +
      encodeURIComponent(1) +
      "&badgeid=1&desc=" +
      encodeURIComponent(asciihex("Double Tab")) +
      "&seq=" +
      encodeURIComponent(genId()),
    function () {},
    printFailed
  );
}

// Updated printQS function to handle requests sequentially
async function printQS() {
  for (let k = 1; k < 11; k++) {
    try {
      await new Promise((resolve, reject) => {
        getStatus(
          "http://localhost:5965/printer?action=print&type=barcode&" +
            "data=" +
            encodeURIComponent(asciihex(k.toString())) +
            "&text=" +
            encodeURIComponent(asciihex(k.toString())) +
            "&quantity=" +
            encodeURIComponent(2) +
            "&badgeid=" +
            encodeURIComponent(0) +
            "&desc=" +
            encodeURIComponent(asciihex("------")) +
            "&seq=" +
            encodeURIComponent(genId()),
          () => {
            resolve(); // Call resolve to proceed to the next request
          },
          () => {
            printFailed(); // Trigger the failure callback
            reject(); // Stop further requests on failure
          }
        );
      });
    } catch (error) {
      console.error("Error in printQS: Request failed");
      break; // Stop further requests if any fail
    }
  }
}

async function printQSZPL() {
  //ZPL:
  var printerHost = "localhost"; // 🔁 Replace with your printer's IP
  var port = 5965;
  var zpl = `
^XA
Boxes
^FO10,10^GB386,180,5^FS
^FO150,10^GB5,180,5^FS
^FO360,10^GB5,180,5^FS
^CF0,140,140
^FB140,1,0,C,0
^FO10,50,2^FD{data}\&^FS
^BY3
^FO175,40
^BCN,130,N,N,Y
^FD{data}^FS
^FX Branding
^FT387,200^A0B,25,25^FB200,1,0,C^FH\^FDSPEED ENTER \&^FS
^XZ`;
  

  
  for (let k = 1; k < 11; k++) {
    var encodedZPL = encodeURIComponent(zpl.replace("{data}", k));
    var url = `http://${printerHost}:${port}/bmp_request?page=printraw&data=${encodedZPL}`
    try {
      await new Promise((resolve, reject) => {
        getStatus(url,
          () => {
            resolve(); // Call resolve to proceed to the next request
          },
          () => {
            printFailed(); // Trigger the failure callback
            reject(); // Stop further requests on failure
          }
        );
      });
    } catch (error) {
      console.error("Error in printQS: Request failed");
      break; // Stop further requests if any fail
    }
  }
}


//Get a now() and format it for making a barcode.
function printNow() {
  // Get the current date and time
var now = new Date();
// Array of month abbreviations
var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Get the month abbreviation
var month = monthNames[now.getMonth()];
// Get the day and pad it with leading zero if necessary
var day = String(now.getDate()).padStart(2, '0');
// Construct the date string
var dateString = 'Date: ' + month + ' ' + day;
// Get the hours and minutes, pad them if necessary
var hours = String(now.getHours()).padStart(2, '0'); // 24-hour format
var minutes = String(now.getMinutes()).padStart(2, '0');
// Construct the time string
var timeString = 'Time: ' + hours + ':' + minutes;
description = dateString.padEnd(43,' ') + timeString;
  printAnylabel("TimePrinted", "TimePrinted", description,1);
}



