// #region Constant Definitions
const {
   app,
   BrowserWindow,
   Menu,
   MenuItem,
   ipcMain,
   dialog,
   nativeImage
} = require('electron');
const url = require('url');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const logger = require('electron-log');
const sqlite3 = require('sqlite3').verbose();

let logPath = path.resolve(__dirname, '../logs');
// Create log folder if missing
if (!fs.existsSync(logPath)) {
   fs.mkdirSync(logPath);
}

logger.transports.file.resolvePath = () => path.join(__dirname, '../logs/main.log');

axios.defaults.timeout = 30000;
axios.defaults.httpsAgent = new https.Agent({ 
   rejectUnauthorized: false,
   keepAlive: true 
});
axios.defaults.headers.post['Content-Type'] = 'application/json';

const baseAllTheBlocksApiUrl = "https://api.alltheblocks.net";
const baseForkBoardApi = "https://fork-board-api-mgmt.azure-api.net";

let homeDir = app.getPath('home');
// #endregion

let appIcon = nativeImage.createFromPath('assets/icons/fork-board-wallet-tool-gray.png');
let displayTheme;

// #region Main Window
let win;

function createWindow() {
   logger.info('Inside CreateWindow() function');
   win = new BrowserWindow({
      width: 1200,
      height: 850,
      webPreferences: {
         nodeIntegration: true,
         contextIsolation: false,
         enableRemoteModule: true
      },
      icon: appIcon
   });
   logger.info(`Loading ${path.join(__dirname, 'index.html')}`);
   win.loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
   }));
}
// #endregion

// #region About Window
let aboutPage;

function createAboutWindow() {
   logger.info('Creating the About window');
   aboutPage = new BrowserWindow({
      width: 550,
      height: 400,
      modal: true,
      show: false,
      parent: win, // Make sure to add parent window here
      autoHideMenuBar: true,

      // Make sure to add webPreferences with below configuration
      webPreferences: {
         nodeIntegration: true,
         contextIsolation: false,
         enableRemoteModule: true
      },
      icon: appIcon
   });

   aboutPage.loadURL(url.format({
      pathname: path.join(__dirname, 'about.html'),
      protocol: 'file:',
      slashes: true
   }));

   aboutPage.once("ready-to-show", function () {
      logger.info('Ready to show - About');
      aboutPage.show();
   });

   aboutPage.once("show", function () {
      logger.info(`Sending load-about-page event`);
      aboutPage.webContents.send("load-about-page", [app.getVersion(), displayTheme, process.platform, process.arch]);
   });
}
// #endregion

// #region Electron Event Handlers

// ************************
// Purpose: This function handles setting the card refresh flag when wallets are deleted from the wallet details page.
// ************************
ipcMain.on('close-about-page', function (_event, _arg) {
   logger.info('Received close-about-page Event');
   aboutPage.hide();
});

// ************************
// Purpose: This function handles the async-get-blockchain-settings event from the Renderer.  It retrieves the block chain settings from ATB and sends the reply event with the data to the Renderer.
// ************************
ipcMain.on('async-get-blockchain-settings', function (event, _arg) {
   logger.info('Received async-get-blockchain-settings event');

   let url = `${baseForkBoardApi}/fork-board/config`;
   logger.info(`Requesting data from ${url}`);

   // Get the blockchain settings
   axios.get(url)
   .then(function (result) {
      let filteredResults = [];
      result.data.every(function(item) {
         let pathName = item.pathName;

         // Silicoin override
         if (item.programName == 'sit') {
            pathName = item.programName;
         }

         // Define the expected fork path
         let forkPath = getForkPath(pathName);

         logger.info(`Checking fork path: ${forkPath}`);

         // If fork path exists on the local machine, then push blockchain settings object to the filtered results array.  This filters out blockchains that don't exist on the current machine.
         if (fs.existsSync(forkPath)) {
            filteredResults.push({
               coinPrefix: item.coinPrefix,
               pathName: pathName,
               displayName: item.displayName,
               mojoPerCoin: item.mojoPerCoin,
               hidden: item.hidden
            });     
         }
         return true;
      });

      logger.info('Sending async-get-blockchain-settings-reply event');
      event.sender.send('async-get-blockchain-settings-reply', filteredResults);
   })
   .catch(function (error) {
      logger.error(error.message);
      event.sender.send('async-get-blockchain-settings-error', [error.message]);
   });
});

// ************************
// Purpose: This function handles retrieving the wallet addresses
// ************************
ipcMain.on('async-export-to-fork-board-import-file-action', function (_event, arg) {
   logger.info('Received async-export-to-fork-board-import-file-action Event');
   exportWalletToolDataFile();
});

// ************************
// Purpose: This function handles retrieving the wallet addresses
// ************************
ipcMain.on('async-retrieve-wallet-addresses', function (event, arg) {
   logger.info('Received async-retrieve-wallet-addresses Event');
   
   if (arg.length == 1) {
      let selectedCoins = arg[0];

      // Iterate through the selectedCoins object
      selectedCoins.every(function (selectedCoin){
         console.log(`Retrieving wallet addresses for ${selectedCoin.coinDisplayName}.`);
         let coinPathName = selectedCoin.coinPathName;
   
         // Get the full path to the wallet db
         let forkWalletDBPath = getForkWalletDBPath(coinPathName);
         
         if (fs.existsSync(forkWalletDBPath)) {
            // open the database
            let db = new sqlite3.Database(forkWalletDBPath, sqlite3.OPEN_READWRITE, (err) => {
               if (err) {
                  console.error(err.message);
               }
               console.log(`Connected to the ${forkWalletDBPath} database.`);
            });

            // Run the query
            db.all(`SELECT puzzle_hash, wallet_type, wallet_id, used FROM derivation_paths WHERE used = 1`, function(err, rows) {
               if (err) {
                  console.error(err.message);
               }
               else {
                  rows.forEach(function (row) {
                     convertPuzzleToWallet(selectedCoin, row.puzzle_hash);
                  });
               }

               closeDb(db);
            });

            return true;
         }
         else {
            win.webContents.send('async-report-error', [`Unable to locate Fork DB: ${forkWalletDBPath}`]);
         }
      });
   }
});

function closeDb(db) {
   db.close((err) => {
      if (err) {
         console.error(err.message);
      }
      console.log('Close the database connection.');
   }); 
}

// #endregion

//#region Menu Setup
const template = [
   {
      id: 'fileMenu',
      label: 'File',
      submenu: [
         {
            role: 'close'
         }
      ]
   },
   {
      label: 'View',
      submenu: [
         {
            role: 'toggledevtools'
         },
         {
            role: 'reload'
         },
         {
            type: 'separator'
         },
         {
            role: 'resetzoom'
         },
         {
            role: 'zoomin'
         },
         {
            role: 'zoomout'
         },
         {
            type: 'separator'
         },
         {
            role: 'togglefullscreen'
         }
      ]
   },
   {
      label: 'About',
      submenu: [
         {
            label: 'ForkBoard Wiki',
            click() {
               logger.info('Opening ForkBoard Wiki in Browser');
               require("electron").shell.openExternal('https://github.com/aaroncarpenter/fork-board/wiki/1.--Home');
            }
         },
         {
            label: 'Contribute on GitHub',
            click() {
               logger.info('Opening ForkBoard Wallet Tool Github in Browser');
               require("electron").shell.openExternal('https://github.com/aaroncarpenter/fork-board-wallet-tool');
            }
         },
         {
            label: 'Join us on Discord',
            click() {
               logger.info('Opening Discord Invite in Browser');
               require("electron").shell.openExternal('https://discord.gg/pW9nNDt8');
            }
         },
         {
            type: 'separator'
         },
         {
            label: 'Report an Issue',
            click() {
               logger.info('Opening ForkBoard Wallet Tool Issues in Browser');
               require("electron").shell.openExternal('https://github.com/aaroncarpenter/fork-board-wallet-tool/issues');
            }
         },
         {
            type: 'separator'
         },
         {
            label: 'About ForkBoard Wallet Tool',
            click() {
               createAboutWindow();
            }
         }  
      ]
   }
];

const menu = Menu.buildFromTemplate(template);

Menu.setApplicationMenu(menu);
// #endregion

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
   logger.info('ready triggered');
   logger.info('executing CreateWindow()');
   createWindow();
});

app.on('window-all-closed', function () {
   if (process.platform !== 'darwin') {
      app.quit();
   }
});

app.on('activate', function () {
   logger.info('activate triggered');
   if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('executing CreateWindow()');
      createWindow();
   }
});

function selectForkDBPath() {
   let filePaths = dialog.showOpenDialogSync(win, { 
      title: 'Open File',
      buttonLabel: 'Select',
      message: 'Please select the chia/fork db file to Open',
      properties: ['openFile'],
      filters: [
         { name: 'SQLite', extensions: ['sqlite'] }
       ] 
   });

   if (filePaths != undefined) {
      var selectedPath = filePaths[0];
      
      if (fs.existsSync(selectedPath)) {
         logger.info('Sending async-set-db-path-action event');
         win.webContents.send('async-set-db-path-action', [selectedPath]); 
      }
   }
}  

// ************************
// Purpose: This function handles the retrieving the walleta address from the puzzle hash.
// ************************
function convertPuzzleToWallet(coinObj, puzzleHash) { 
   let data = {
      "prefix": coinObj.coinPrefix,
      "puzzleHash": puzzleHash
   };
   
   axios.post(`${baseAllTheBlocksApiUrl}/atb/utilities/puzzlehash-to-address`, JSON.stringify(data))
   .then(function (result) {
      win.webContents.send('async-retrieve-wallet-addresses-reply', [coinObj, result.data.address]); 
   })
   .catch(function (error) {
      logger.error(error.message);
      win.webContents.send('async-report-error', [error.message]);
   });
}

function exportWalletToolDataFile() {
   let filePaths = dialog.showOpenDialogSync(win, { 
      title: 'Select a Destination',
      buttonLabel: 'Export',
      message: 'Please select the location to export the wallet tool data',
      properties: ['openDirectory']
   });

   if (filePaths != undefined) {
         logger.info('Sending async-export-wallet-tool-data event');
         win.webContents.send('async-export-wallet-tool-data', [filePaths[0]]); 
   }
} 

function getForkWalletDBPath(coinPath) {
   let forkWalletFolder = "";
   let forkWalletDBPath = "";
   if(process.platform == 'win32') {
      forkWalletFolder = `${getForkPath(coinPath)}\\mainnet\\wallet\\db`;
   }
   else {
      forkWalletFolder = `${getForkPath(coinPath)}/mainnet/wallet/db`;
   }

   if (fs.existsSync(forkWalletFolder)) {
      let files = fs.readdirSync(forkWalletFolder);

      for (let i=0; i<files.length; i++) {
         let filename = files[i];

         if (filename.includes("blockchain_wallet_v1_mainnet")) {
            if(process.platform == 'win32') {
               forkWalletDBPath = `${forkWalletFolder}\\${filename}`;
            }
            else {
               forkWalletDBPath = `${forkWalletFolder}/${filename}`;
            }
            break;
         }
      }
   }
   else {
      logger.info('Sending aasync-report-error event');
      win.webContents.send('async-report-error', [`Unable to locate Fork DB Folder: ${forkWalletFolder}`]);
   }

   return forkWalletDBPath;
}

function getForkPath(coinPath) {
   if(process.platform == 'win32') {
      return `${homeDir}\\.${coinPath}`;
   }
   else {
      return `${homeDir}/.${coinPath}`;
   }
}