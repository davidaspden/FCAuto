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
    badge= "13372023"
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
      "data=654964&text=" +
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
      "data=65494964&text=" +
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


