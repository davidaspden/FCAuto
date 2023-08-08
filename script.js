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
          else{
            return false;
          }
        }
    }
}
var badgeID = getQueryVariable("badgeID");

//////////////////////////////////////////////////////////
function asciihex(str) {
  var text = "";
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
function printAnylabel(b, t, d,n) {
  getStatus(
    if(badgeID){
      badge = badgeID;
    }
    else{
      badge= "13372023"
    }
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