// #region Const Definitions
   const {ipcRenderer, clipboard} = require('electron');
   const Utils = require('./utils');
   const path = require('path');
   const fs = require('fs');
   const logger = require('electron-log');
   logger.transports.file.resolvePath = () => path.join(__dirname, '../logs/view.log');
// #endregion

// #region Variable Definitions
   let $ = require('jquery');

   let utils = new Utils();

   let coinConfigObj = [];
   let walletObj = [];
   let selectedCoins = [];
   let selectedCoinsStr = "";

$(function () {
   logger.info('Sending async-check-latest-app-version event');
   ipcRenderer.send('async-check-latest-app-version', []);

   logger.info('Sending async-get-blockchain-settings');
   ipcRenderer.send('async-get-blockchain-settings', []); 
});

// #region Page Event Handlers

$('#retrieve-wallet-addresses').on('click', function () {
   if (selectedCoins.length == 0) {
      utils.showWarnMessage(logger, "You must first select a coin before attempting to retrieval.", 2000);
   }
   else {
      // Clear the existing wallets
      walletObj = [];
      $('.walletCard').remove();

      // Issue the retrieve wallet addresses event
      logger.info('Sending async-retrieve-wallet-addresses');
      ipcRenderer.send('async-retrieve-wallet-addresses', [selectedCoins]); 
   }
});

$('#coin-selectall-button').on('click', function () {
     // Iterate through all checked coins and push those coin's config objects to the selectedCoins object array
   $('.form-check-input:not(:checked)').each(function(index) {
     $(this).prop("checked", true);
   });
   updateSelectedCoin();
});

$('#copy-wallet-addresses-to-clipboard').on('click', function () {
   let walletList = "";
   // Iterate through the wallet object
   walletObj.every(function (walletItem) {
      if (walletList.length != 0) {
         walletList += ", ";
      }
      walletList += walletItem.wallet;

      return true;
   });

   // Write the text to clipboard
   clipboard.writeText(walletList);
});

$('#export-to-fork-board-import-file').on('click', function () {
   logger.info('Sending async-export-to-fork-board-import-file-action');
   ipcRenderer.send('async-export-to-fork-board-import-file-action', []); 
});

// ***********************
// Name: 	updateSelectedCoin
// Purpose: This function changes the sort order.
//    Args: N/A
//  Return: N/A
// ************************
function updateSelectedCoin() {
   // Clear global vars
   selectedCoins = [];
   selectedCoinsStr = "";

   // Iterate through all checked coins and push those coin's config objects to the selectedCoins object array
   $('.form-check-input:checked').each(function(index) {
      let selectedVal = $(this).val();
      coinConfigObj.every(function (coinConfig) {      
         if (coinConfig.coinPathName == selectedVal) {
            selectedCoins.push(coinConfig);
            return false;
         }

         return true;
      });
   });

   // Iterate through the selectedCoins object array to build a comma separated list of coins
   selectedCoins.every(function (selectedCoinCfg) {      
      if (selectedCoinsStr.length != 0) {
         selectedCoinsStr += ', ';
      }
      selectedCoinsStr += selectedCoinCfg.coinDisplayName;

      return true;
   });

   // Set to None if no coins selected
   if (selectedCoinsStr == "") {
      selectedCoinsStr = "None";
   }

   // Set the page element
   $('#coin-dropdown-button small').html(`Selected Coin${selectedCoinsStr.includes(',') ? 's' : ''}: <br />${selectedCoinsStr}`);

   // Activate the retrieve button only if one or more coins is selected
   if (selectedCoins.length > 0) {
      $('#retrieve-wallet-addresses').removeClass('disabled');
   }
   else {
      $('#retrieve-wallet-addresses').addClass('disabled');
   }

   // Hide action buttons
   $('#copy-wallet-addresses-to-clipboard').hide();
   $('#export-to-fork-board-import-file').hide();

   // Remove existing wallet cards if coin selection changes.
   $('.walletCard').remove();
}
// #endregion

// #region Async Event Handlers

// ************************
// Purpose: This function is a handler for an error event from ipcMain
// ************************
ipcRenderer.on('async-report-error', (event, arg) => {
   logger.info('Received async-report-error');
 
   if (arg.length == 1) {
      let errMsg = arg[0];
      utils.showWarnMessage(logger, errMsg, 5000);
   }
   else {
      logger.error('Reply args incorrect');
   }
});

// ************************
// Purpose: This function is a handler for an event from ipcMain, triggered when the walleta ddress is retrieved
// ************************
ipcRenderer.on('async-retrieve-wallet-addresses-reply', (event, arg) => {
   logger.info('Received async-retrieve-wallet-addresses-reply');
 
   if (arg.length == 2) {
      let coinObj = arg[0];
      let walletAddr = arg[1];

      // create coin wallet card container if not found
      if ($('#'+coinObj.coinPathName+'-wallet-address-card').length == 0) {
         let card = `<div id="${coinObj.coinPathName}-wallet-address-card" class="walletCard col-md-6"><div class="card"><div class="card-header"><div style="width: 100%; text-align: center;"><small><b>${coinObj.coinDisplayName} Wallet Addresses</b></div></div><div class="card-body" style="text-align: center;"></div></div></div>`;
         $('#wallet-address-cards').append(card);
      }

      // append the wallet address
      $('#'+coinObj.coinPathName+'-wallet-address-card .card-body').append(`<p style="margin-bottom: 8px;"><small>${walletAddr}</small></p>`);

      // store address value to obj
      walletObj.push({ 'wallet': walletAddr });

      $('#copy-wallet-addresses-to-clipboard').show();
      $('#export-to-fork-board-import-file').show();
   }
});

// ************************
// Purpose: This function is a handler for an event from ipcMain, triggered when the user selects the wallet export location.
// ************************
ipcRenderer.on('async-export-wallet-tool-data', (event, arg) => {
   logger.info('Received async-export-wallet-tool-data');
 
   if (arg.length == 1) {
      // Generate a timestamp string
      let currDate = new Date();
      let currTimestamp = `${currDate.getFullYear()}${(currDate.getMonth()+1 < 10 ? '0' : '')}${currDate.getMonth()+1}${(currDate.getDate()+1 < 10 ? '0' : '')}${currDate.getDate()}${(currDate.getHours()+1 < 10 ? '0' : '')}${currDate.getHours()}${(currDate.getMinutes()+1 < 10 ? '0' : '')}${currDate.getMinutes()}${(currDate.getSeconds()+1 < 10 ? '0' : '')}${currDate.getSeconds()}`;

      // Set the filename
      let backupDest = arg[0];
      let backupFilename = path.join(backupDest, `forkboard-wallettool-export-${currTimestamp}.json`);
      
      // format export file
      let backFileStr = `{
         "name": "ForkBoard Wallet Tool Export File",
         "date": "${currDate.toLocaleString('en-US')}",
         "forks": "${selectedCoinsStr}",
         "walletConfiguration": ${JSON.stringify(walletObj, null, '\t')}
      }`;

      // write the walletObj to the backup location
      fs.writeFileSync(backupFilename, backFileStr);

      utils.showWarnMessage(logger, `Successfully created export file - ${backupFilename}`, 4000);
   }
});

// ************************
// Purpose: This function receives the blockchain settings reply from ipcMain and loads the dashboard
// ************************
ipcRenderer.on('async-get-blockchain-settings-reply', (event, arg) => {
   logger.info('Received async-get-blockchain-settings-reply event');
   
   if (arg.length > 0) {
      coinConfigObj = [];

      // Push data from args into the coinConfigObj
      arg.every(function (blockSettings) {
         coinConfigObj.push({
            coinPrefix: blockSettings.coinPrefix,
            coinPathName: blockSettings.pathName,
            coinDisplayName: blockSettings.displayName,
            mojoPerCoin: blockSettings.mojoPerCoin,
            hidden: blockSettings.hidden
         });

         return true;
      });

      // sort the array on name
      coinConfigObj.sort(utils.applySort('coinDisplayName', 'asc'));

      // For all returned coins, create checkbox entries in the dropdown content div
      coinConfigObj.every(function (coinConfig) {
         let coinDiv = `<div class="col-lg-2 col-md-4 col-sm-6"><input class="form-check-input me-1" type="checkbox" onclick="updateSelectedCoin()" value="${coinConfig.coinPathName}" aria-label="..."><small>${coinConfig.coinDisplayName}</small></div>`;
         $('#coin-dropdown-content').append(coinDiv);
         return true;
      });

      if (coinConfigObj.length == 0) {
         let coinDiv = `<div class="col-lg-2 col-md-4 col-sm-6"><small>No forks were found in your home directory.</small></div>`;
         $('#coin-dropdown-content').append(coinDiv);
      }
   }
   else {
      let coinDiv = `<div class="col-lg-4 col-md-6 col-sm-8"><small>No forks were found in your home directory.</small></div>`;
      $('#coin-dropdown-content').append(coinDiv);
   }
});

// ************************
// Purpose: This function receives the version information reply from ipcMain, checks latest version against current version.
// ************************
ipcRenderer.on('async-check-latest-app-version-reply', (event, arg) => {
   logger.info('Received async-check-latest-app-version-reply event')

   if (arg.length == 1) {
      let replyData = arg[0];
      let message = `You are currently running ForkBoard Wallet Tool v${replyData.currentVersion}.  An updated version (<i><b>v${replyData.latestVersion}</b></i>) was released on ${new Date(replyData.publishedDate).toLocaleString('en-US')}.  Click to the right to download the latest versions.`;
      let instructions = replyData.releaseNotes;

      $('#infoVersionMessage').html(message);
      $('#infoVersionNotes').html(`<br><u><b>ForkBoard Wallet Toolv${replyData.latestVersion} Release Notes</b></u><br>${instructions}`);

      //$('#version-download-buttons').append(`<small class="text-muted">Downloads</small>`);
      $('#version-download-buttons').append(`<div><a href="${replyData.downloadURL_Windows}" class="btn btn-primary"><small>Windows</small></a></div>`);
      $('#version-download-buttons').append(`<div><a href="${replyData.downloadURL_MacOS}" class="btn btn-primary"><small>MacOS</small></a></div>`);
      $('#version-download-buttons').append(`<div><a href="${replyData.downloadURL_Ubuntu}" class="btn btn-primary"><small>Ubuntu</small></a></div>`);

      $('#infoVersionBox').fadeIn(400, 'swing');
      
      setTimeout(
         function () {
            $('#infoVersionBox').fadeOut(400, 'swing');
         }, 10000
      );
   }
   else {
      logger.error('Reply args incorrect');
   }
});

// ************************
// Purpose: This function receives the exchange rates error from ipcMain.
// ************************
ipcRenderer.on('async-check-latest-app-version-error', (event, arg) => {
   logger.info('Received async-check-latest-app-version-error event')
   
   if (arg.length == 1) {
      let errMsg = arg[0];
      let message = `There was an error getting the latest App Version Information from Github.  The reported error is "${errMsg}".`;
      let instructions = 'Please restart the application.  Reach out to us on Discord or log an issue in Github if the issue continue.';
      utils.showErrorMessage(logger, message, instructions);
   }
   else {
      logger.error('Reply args incorrect');
   }
});

// ************************
// Purpose: This function receives the blockchain settings error from ipcMain.
// ************************
ipcRenderer.on('async-get-blockchain-settings-error', (event, arg) => {
   logger.info('Received async-get-blockchain-settings-error event')
   
   if (arg.length = 1) {
      let errMsg = arg[0];
      let message = `There was an error getting the Blockchain Settings Information.  The reported error is "${errMsg}".`;
      let instructions = 'Please restart the application.  Reach out to us on Discord or log an issue in Github if the issue continue.';
      utils.showErrorMessage(logger, message, instructions);
   }
   else {
      logger.error('Reply args incorrect');
   }
});

// #endregion
