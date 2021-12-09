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
const https = require('https');
const logger = require('electron-log');
logger.transports.file.resolvePath = function () {
   return path.join(__dirname, 'logs/main.log');
};

axios.defaults.timeout = 30000;
axios.defaults.httpsAgent = new https.Agent({ 
   rejectUnauthorized: false,
   keepAlive: true 
});

// #endregion

// quit if startup from squirrel installation.
if (require('electron-squirrel-startup')) return app.quit();

let appIcon = nativeImage.createFromPath('assets/icons/fork-board-gray.png');
let displayTheme;

// #region Main Window
let win;

function createWindow() {
   win = new BrowserWindow({
      width: 1500,
      height: 1200,
      webPreferences: {
         nodeIntegration: true,
         contextIsolation: false,
         enableRemoteModule: true
      },
      icon: appIcon
   });
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
      width: 500,
      height: 410,
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
   axios.get(url)
   .then(function (result) {
      logger.info('Sending async-get-blockchain-settings-reply event');
      event.sender.send('async-get-blockchain-settings-reply', result.data);
   })
   .catch(function (error) {
      logger.error(error.message);
      event.sender.send('async-get-blockchain-settings-error', [error.message]);
   });
});

// ************************
// Purpose: This function handles the async-get-fork-prices event from the Renderer.  It retrieves the fork prices from XCHForks.com and sends the reply event with the data to the Renderer.
// ************************
ipcMain.on('async-get-fork-prices', function (event, _arg) {
   logger.info('Received async-get-fork-prices event');
 
   let url = `${baseForkBoardApi}/fork-board/price`;

   logger.info(`Requesting data from ${url}`);
   axios.get(url)
   .then(function (result) {
      logger.info('Sending async-get-fork-prices-reply event');
      event.sender.send('async-get-fork-prices-reply', result.data);
   })
   .catch(function (error) {
      logger.error(error.message);
      event.sender.send('async-get-fork-prices-error', [error.message]);
   });
});

// ************************
// Purpose: This function handles the async-get-fork-prices event from the Renderer.  It retrieves the fork prices from XCHForks.com and sends the reply event with the data to the Renderer.
// ************************
ipcMain.on('load-main-dashboard', function (event, arg) {
   logger.info('Received load-main-dashboard event');

   if (arg.length == 1) {
      displayTheme = arg[0];
   }

   logger.info('Sending load-main-dashboard-reply event');
   event.sender.send('load-main-dashboard-reply', [app.getVersion(), process.platform, process.arch]);
});
// #endregion

//#region Menu Setup
const template = [
   {
      id: 'fileMenu',
      label: 'File',
      submenu: [
         {
            label: 'Set Launcher Ids',
            click() {
               logger.info('Sending async-set-launcher event');
               win.webContents.send('async-set-launcher', []);
            },
            accelerator: 'Alt+CmdOrCtrl+L'
         },
         {
            label: 'Add Wallet',
            click() {
               logger.info('Sending async-add-wallet event');
               win.webContents.send('async-add-wallet', []);
            },
            accelerator: 'Alt+CmdOrCtrl+A'
         },
         {
            label: 'Refresh',
            click() {
               logger.info('Sending async-refresh-wallets event');
               win.webContents.send('async-refresh-wallets', []);
            },
            accelerator: 'Alt+CmdOrCtrl+R'
         },
         {
            type: 'separator'
         },
         {
            label: 'Backup ForkBoard Settings',
            click() {
               backupWalletConfig();   
            },
            accelerator: 'Alt+CmdOrCtrl+B'
         },
         {
            label: 'Restore ForkBoard Settings',
            click() {
               restoreWalletConfig();
            }
         },
         {
            type: 'separator'
         },
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
      label: 'Sponsors',
      submenu: [
         {
            label: 'SpaceFarmers.io',
            click() {
               logger.info('Opening SpaceFarmers.IO page in Browser');
               require("electron").shell.openExternal('https://spacefarmers.io');
            }
         }
      ]
   },
   {
      label: 'Partners',
      submenu: [
         {
            label: 'AllTheBlock.NET',
            click() {
               logger.info('Opening AllTheBlock.NET page in Browser');
               require("electron").shell.openExternal('https://alltheblocks.net');
            }
         },
         {
            type: 'separator'
         },
         {
            label: 'Chia Forks Blockchain',
            click() {
               logger.info('Opening Chia Forks Blockchain page in Browser');
               require("electron").shell.openExternal('https://chiaforksblockchain.com');
            }
         },
         {
            label: 'Forks Chia Exchanger',
            click() {
               logger.info('Opening Forks Chia Exchanger page in Browser');
               require("electron").shell.openExternal('https://forkschiaexchange.com');
            }
         },
         {
            label: 'Casino Maize',
            click() {
               logger.info('Opening Casino Maize page in Browser');
               require("electron").shell.openExternal('https://casino.maize.farm');
            }
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
               logger.info('Opening ForkBoard Github in Browser');
               require("electron").shell.openExternal('https://github.com/aaroncarpenter/fork-board');
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
               logger.info('Opening ForkBoard Issues in Browser');
               require("electron").shell.openExternal('https://github.com/aaroncarpenter/fork-board/issues');
            }
         },
         {
            type: 'separator'
         },
         {
            label: 'About ForkBoard',
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
app.on('ready', createWindow);

app.on('window-all-closed', function () {
   if (process.platform !== 'darwin') {
      app.quit();
   }
});

app.on('activate', function () {
   if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
   }
});

function backupWalletConfig() {
   let filePaths = dialog.showOpenDialogSync(win, { 
      title: 'Select a Backup Destination',
      buttonLabel: 'Backup',
      message: 'Please select the location to backup the wallet configuration',
      properties: ['openDirectory'] 
   });

   if (filePaths != undefined) {
         logger.info('Sending async-backup-wallet-config-action event');
         win.webContents.send('async-backup-wallet-config-action', [filePaths[0]]); 
   }
}  

function restoreWalletConfig() {
   let filePaths = dialog.showOpenDialogSync(win, { 
      title: 'Select a Wallet Backup to Restore',
      buttonLabel: 'Restore',
      message: 'Please select the wallet backup file to Restore',
      properties: ['openFile'],
      filters: [
         { name: 'JSON', extensions: ['json'] },
         { name: 'All Files', extensions: ['*'] }
       ] 
   });

   if (filePaths != undefined) {
      logger.info('Sending async-restore-wallet-config-action event');
      win.webContents.send('async-restore-wallet-config-action', [filePaths[0]]); 
   }
}  