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
  var preset = {
    id: createPresetId(),
    barcode: barcode,
    displayText: displayText
  };
  var pre = buildUserPresetButton(preset);
  var presets = document.getElementById("presets");
  presets.appendChild(pre);

  var saved = getUserPresets();
  saved.push(preset);
  saveUserPresets(saved);
}

function loadPresets() {
  var saved = getUserPresets();
  var presetsDiv = document.getElementById("presets");
  var migrated = false;

  saved.forEach(function(p) {
    if (!p.id) {
      p.id = createPresetId();
      migrated = true;
    }
    var pre = buildUserPresetButton(p);
    presetsDiv.appendChild(pre);
  });

  if (migrated) {
    saveUserPresets(saved);
  }
}

function clearUserPresets() {
  localStorage.removeItem('userPresets');
  // Remove dynamically added buttons (leave the hardcoded ones)
  var presetsDiv = document.getElementById("presets");
  var buttons = presetsDiv.querySelectorAll('a.apmbutton[data-user]');
  buttons.forEach(function(b) { b.remove(); });
}

function createPresetId() {
  return Date.now().toString(36) + '-' + genId();
}

function getUserPresets() {
  try {
    var saved = JSON.parse(localStorage.getItem('userPresets') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}

function saveUserPresets(saved) {
  localStorage.setItem('userPresets', JSON.stringify(saved));
}

function buildUserPresetButton(preset) {
  var pre = document.createElement('a');
  var label = preset.displayText != '' ? preset.displayText : preset.barcode;
  pre.appendChild(document.createTextNode(label));

  var deleteBtn = document.createElement('span');
  deleteBtn.classList.add('delete-btn');
  deleteBtn.title = 'Remove preset';
  deleteBtn.setAttribute('aria-label', 'Remove preset');
  deleteBtn.textContent = '×';
  pre.appendChild(deleteBtn);

  pre.dataset.user = 'true';
  pre.dataset.presetId = preset.id;
  pre.classList.add('apmbutton');
  pre.onclick = function() {
    printAnylabel(
      preset.displayText != '' ? preset.displayText : preset.barcode,
      preset.barcode != '' ? preset.barcode : preset.displayText,
      'ISS Exception',
      2
    );
  };
  return pre;
}

function removeStoredPreset(presetId) {
  var saved = getUserPresets();
  var index = saved.findIndex(function(p) {
    return p.id === presetId;
  });
  if (index === -1) {
    return;
  }
  saved.splice(index, 1);
  saveUserPresets(saved);
}

function bindUserPresetDeleteHandler() {
  var presetsDiv = document.getElementById('presets');
  if (!presetsDiv) {
    return;
  }

  // Capture phase prevents the anchor click handler from firing on delete clicks.
  presetsDiv.addEventListener('click', function(event) {
    var deleteBtn = event.target.closest('.delete-btn');
    if (!deleteBtn) {
      return;
    }

    var presetButton = deleteBtn.closest('a.apmbutton[data-user]');
    if (!presetButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    removeStoredPreset(presetButton.dataset.presetId);
    presetButton.remove();
  }, true);
}

function applyTitleGradientTheme(themeName) {
  var validThemes = ['amazon-blue', 'subtle-pink', 'blue-white'];
  var theme = validThemes.indexOf(themeName) !== -1 ? themeName : 'amazon-blue';
  document.documentElement.setAttribute('data-title-gradient', theme);

  var choices = document.querySelectorAll('.gradient-choice');
  choices.forEach(function(choice) {
    choice.classList.toggle('active', choice.dataset.gradientChoice === theme);
  });

  return theme;
}

function normalizeGradientTheme(themeName) {
  var map = {
    'amazon-blue': 'amazon-blue',
    'amazonBlue': 'amazon-blue',
    'blue': 'amazon-blue',
    'subtle-pink': 'subtle-pink',
    'subtlePink': 'subtle-pink',
    'pink': 'subtle-pink',
    'blue-white': 'blue-white',
    'blueWhite': 'blue-white',
    'blue-to-white': 'blue-white',
    'white-blue': 'blue-white'
  };

  return map[themeName] || 'amazon-blue';
}

function getStoredGradientTheme() {
  var keys = ['titleGradientTheme', 'selectedGradientTheme', 'selectedGradient'];
  for (var i = 0; i < keys.length; i++) {
    var value = localStorage.getItem(keys[i]);
    if (value) {
      return normalizeGradientTheme(value);
    }
  }
  return 'amazon-blue';
}

function initGradientPicker() {
  var picker = document.getElementById('gradientPicker');
  var storedTheme = getStoredGradientTheme();
  var appliedTheme = applyTitleGradientTheme(storedTheme);
  localStorage.setItem('titleGradientTheme', appliedTheme);

  if (!picker) {
    return;
  }

  picker.addEventListener('click', function(event) {
    var choice = event.target.closest('.gradient-choice');
    if (!choice) {
      return;
    }

    var theme = choice.dataset.gradientChoice || choice.dataset.gradient;
    var applied = applyTitleGradientTheme(theme);
    localStorage.setItem('titleGradientTheme', applied);
  });
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

document.addEventListener('DOMContentLoaded', function() {
  loadPresets();
  bindUserPresetDeleteHandler();
  initGradientPicker();
});

document.addEventListener('keydown', function(event) {
    // Prevent shortcuts from firing if you're actively typing in the input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    // Check if the pressed key is between 1 and 9
    if (event.key >= '1' && event.key <= '9') {
        var presetIndex = parseInt(event.key) - 1;
        
        // Targets all 'a' tags that live inside your presets div
        // Change '#presets' to match the actual ID or class name of your container div
        var presets = document.querySelectorAll('#presets a');
        
        if (presets[presetIndex]) {
            event.preventDefault(); // Prevents the page from jumping or scrolling
            presets[presetIndex].click();
        }
    }
});



