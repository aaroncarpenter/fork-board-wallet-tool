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
   let selectedCoin = "";
   let selectedDBFile = "";
   let selectedCoinConfig = {};

$(function () {
   logger.info('Sending async-get-blockchain-settings');
   ipcRenderer.send('async-get-blockchain-settings', [$('#db-path-text').text()]); 
});

// #region Page Event Handlers

$('#retrieve-wallet-addresses').on('click', function () {
   if (selectedCoin == "" || selectedDBFile == "") {
      utils.showWarnMessage(logger, "You must first select a coin and a DB file before attempting to retrieval.", 2000);
   }
   else {
      walletObj = [];

      $('.walletCard').remove();

      logger.info('Sending async-retrieve-wallet-addresses');
   
      ipcRenderer.send('async-retrieve-wallet-addresses', [selectedCoinConfig.coinDisplayName, selectedCoinConfig.coinPrefix, selectedDBFile]); 
   }
});

$('#copy-wallet-addresses-to-clipboard').on('click', function () {
   let walletList = "";

   walletObj.every(function (walletItem) {
      if (walletList.length != 0) {
         walletList += ", ";
      }
      walletList += walletItem.wallet;

      return true;
   });

   clipboard.writeText(walletList);
});

$('#export-to-fork-board-import-file').on('click', function () {
   logger.info('Sending async-export-to-fork-board-import-file-action');
   ipcRenderer.send('async-export-to-fork-board-import-file-action', []); 
});

function pasteTextFromClipboard(elementId)
{
   let clipboardText = clipboard.readText();
   let currWalletVal = $(elementId).val();

   if (currWalletVal == null || currWalletVal == "") {
      $(elementId).val(clipboardText);
   }
   else if (currWalletVal.endsWith(',') || currWalletVal.endsWith(', ')) {
      $(elementId).val(`${currWalletVal}${clipboardText}`);
   }
   else {
      $(elementId).val(`${currWalletVal}, ${clipboardText}`);
   }
}

$('#db-path-button').on('click', function () { 
   $('#copy-wallet-addresses-to-clipboard').hide();
   $('#export-to-fork-board-import-file').hide();
   ipcRenderer.send('async-open-db-path-dialog', []); 
});

// ***********************
// Name: 	updateSelectedCoin
// Purpose: This function changes the sort order.
//    Args: N/A
//  Return: N/A
// ************************
function updateSelectedCoin(coin) {
   selectedCoin = coin;

   coinConfigObj.every(function (coinConfig) {      
      if (coinConfig.coinDisplayName == selectedCoin) {
         selectedCoinConfig = coinConfig;
         return false;
      }

      return true;
   });

   $('#coin-dropdown-button small').html(`Selected Coin: <br />${coin}`);

   if (selectedCoin != "" && selectedDBFile != "") {
      $('#retrieve-wallet-addresses').removeClass('disabled');
   }

   $('#copy-wallet-addresses-to-clipboard').hide();
   $('#export-to-fork-board-import-file').hide();
   $('.walletCard').remove();
}
// #endregion

// #region Async Event Handlers

// ************************
// Purpose: This function is a handler for an event from ipcMain, triggered when the user picks a fork DB 
// ************************
ipcRenderer.on('async-set-db-path-action', (event, arg) => {
   logger.info('Received async-set-db-path-action');
 
   if (arg.length == 1) {
      let dbFileName = arg[0];

      $('#db-path-button small').html(`Selected Fork DB: <br /> ${dbFileName}`);

      selectedDBFile = dbFileName;

      if (selectedCoin != "" && selectedDBFile != "") {
         $('#retrieve-wallet-addresses').removeClass('disabled');
      }

      $('.walletCard').remove();
   }
});

// ************************
// Purpose: This function is a handler for an event from ipcMain, triggered when the user picks a fork DB 
// ************************
ipcRenderer.on('async-retrieve-wallet-addresses-error', (event, arg) => {
   logger.info('Received async-retrieve-wallet-addresses-error');
 
   if (arg.length == 1) {
      let errMsg = arg[0];
      utils.showWarnMessage(logger, errMsg, 5000);
   }
   else {
      logger.error('Reply args incorrect');
   }
});

// ************************
// Purpose: This function is a handler for an event from ipcMain, triggered when the user picks a fork DB 
// ************************
ipcRenderer.on('async-retrieve-wallet-addresses-reply', (event, arg) => {
   logger.info('Received async-retrieve-wallet-addresses-reply');
 
   if (arg.length == 1) {
      let card = `<div class="walletCard col-md-6"><div class="card"><div class="card-header"><div style="width: 100%; text-align: center;"><small><b>Wallet Address</b></div></div><div class="card-body" style="text-align: center;"><small>${arg[0]}</small></div></div></div>`;
      $('#wallet-address-cards').append(card);

      walletObj.push({ 'wallet': arg[0] });

      $('#copy-wallet-addresses-to-clipboard').show();
      $('#export-to-fork-board-import-file').show();
   }
});

// ************************
// Purpose: This function is a handler for an event from ipcMain, triggered when the user picks a fork DB 
// ************************
ipcRenderer.on('async-export-wallet-tool-data', (event, arg) => {
   logger.info('Received async-export-wallet-tool-data');
 
   if (arg.length == 1) {
      let backupDest = arg[0];

      let currDate = new Date();
      let currTimestamp = `${currDate.getFullYear()}${currDate.getMonth()}${currDate.getDate()}${currDate.getHours()}${currDate.getMinutes()}${currDate.getSeconds()}`;

      let backupFilename = path.join(backupDest, `forkboard-wallettool-export-${selectedCoinConfig.coinPathName}-${currTimestamp}.json`);
      // write the walletObj to the backup location

      let backFileStr = `{
         "name": "ForkBoard Wallet Tool Export File",
         "date": "${currDate.toLocaleString('en-US')}",
         "coinPath": "${selectedCoinConfig.coinPathName}",
         "walletConfiguration": ${JSON.stringify(walletObj, null, '\t')}
      }`;
      
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

      coinConfigObj.sort(utils.applySort('coinDisplayName', 'asc'));

      // Push data from args into the coinConfigObj
      coinConfigObj.every(function (coinConfig) {
         let coin = `<div class="col-sm-4"><button  type="button" class="btn" style="padding-top: 5px; padding-bottom: 5px;" onclick="updateSelectedCoin('${coinConfig.coinDisplayName}')"><small>${coinConfig.coinDisplayName}</small></button></div>`;
         $('#coin-dropdown-content').append(coin);

         return true;
      });
   }
   else {
      logger.error('Reply args incorrect');
   }
});

// #endregion
