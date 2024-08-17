
// © 2020 - 2024  Simsv Studio

const {app, BrowserWindow, ipcMain, dialog, nativeImage, Tray, Menu, screen} = require("electron");
const {exec} = require("child_process");
const path = require("path");

app.commandLine.appendSwitch("enable-smooth-scrolling");
app.commandLine.appendSwitch("enable-features", "WindowsScrollingPersonality");

// 创建窗口
const SimMusicWindows = {};
let tray;
function showMainWin() {
	SimMusicWindows.mainWin.show();
	if (SimMusicWindows.mainWin.isMinimized()) {SimMusicWindows.mainWin.restore();}
	SimMusicWindows.mainWin.focus();
}
const createWindow = () => {
	// 主窗体
	SimMusicWindows.mainWin = new BrowserWindow({
		width: 1000,
		height: 700,
		minWidth: 1000,
		minHeight: 700,
		frame: false,
		resizable: true,
		backgroundColor: "#1E9FFF",
		title: "SimMusic",
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false }
	});
	SimMusicWindows.mainWin.loadURL(path.join(__dirname, "frontend/main.html"));
	SimMusicWindows.mainWin.on("close", e => {
		e.preventDefault();
		SimMusicWindows.mainWin.hide();
	});
	// 歌词窗体
	SimMusicWindows.lrcWin = new BrowserWindow({
		width: 0,
		height: 0,
		frame: false,
		resizable: false,
		show: false,
		transparent: true,
		focusable: false,
		alwaysOnTop: true,
		backgroundThrottling: true,
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false }
	});
	SimMusicWindows.lrcWin.loadURL(path.join(__dirname, "frontend/lrc.html"));
	SimMusicWindows.lrcWin.maximize();
}
app.whenReady().then(() => {
	tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "frontend/assets/icon-blue.png")));
	tray.on("click", () => { showMainWin(); });
	tray.setToolTip("SimMusic");
	createWindow();
	if (!app.requestSingleInstanceLock()) {
		app.exit();
		return;
	}
	app.on("second-instance", () => {
		showMainWin();
	});
});


// 处理窗口事件
ipcMain.handle("winOps", (_event, args) => {
	return SimMusicWindows[args[0]][args[1]]();
});
ipcMain.handle("restart", () => {
	app.exit();
	app.relaunch();
});
ipcMain.handle("quitApp", () => {
	app.exit();
});


// 对话框
ipcMain.handle("dialog", (_event, type, txt, parent, dialogId) => {
	const dialogWindow = new BrowserWindow({
		parent: SimMusicWindows[parent], 
		modal: true,
		width: 500,
		height: 200,
		frame: false,
		resizable: false,
		show: false,
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false }
	});
	dialogWindow.loadURL(path.join(__dirname, `frontend/assets/components/dialog.html?type=${type}&txt=${encodeURIComponent(txt)}&parent=${parent}&dialogId=${dialogId}`));
	dialogWindow.once("ready-to-show", () => { dialogWindow.show(); });
});
ipcMain.handle("dialogSubmit", (_event, parent, dialogId, txt) => {
	SimMusicWindows[parent].webContents.send("dialogSubmit", dialogId, txt);
});
ipcMain.handle("dialogCancel", (_event, parent) => {
	SimMusicWindows[parent].webContents.send("dialogCancel");
});


// 任务栏控件
const createTaskbarButtons = (isPlay) => {
	SimMusicWindows.mainWin.setThumbarButtons([
		{
			tooltip: "上一首",
			icon: nativeImage.createFromPath(path.join(__dirname, "frontend/assets/misc/taskbar-prev.png")),
			click () {SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.prev()", true);}
		}, {
			tooltip: isPlay ? "暂停" : "播放",
			icon: nativeImage.createFromPath(path.join(__dirname, isPlay ? "frontend/assets/misc/taskbar-pause.png" : "frontend/assets/misc/taskbar-play.png")),
			click () {SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.togglePlay()", true);}
		}, {
			tooltip: "下一首",
			icon: nativeImage.createFromPath(path.join(__dirname, "frontend/assets/misc/taskbar-next.png")),
			click () {SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.next()", true);}
		}
	]);
	const menu = Menu.buildFromTemplate([
		{ label: "SimMusic", type: "normal", enabled: false},
		{ type: "separator" },
		{ label: "显示主窗口", type: "normal", click() { showMainWin(); }},
		{ label: isPlay ? "暂停" : "播放", type: "normal", click () {SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.togglePlay()", true);}},
		{ type: "separator" },
		{ label: "退出应用", type: "normal", click: app.exit},
	]);
	tray.setContextMenu(menu);
}
ipcMain.handle("musicPlay", () => {
	if (lyricsShowing) SimMusicWindows.lrcWin.webContents.send("setHidden", "inside", false);
	createTaskbarButtons(true);
});
ipcMain.handle("musicPause", () => {
	SimMusicWindows.lrcWin.webContents.send("setHidden", "inside", true);
	createTaskbarButtons(false);
});



// 桌面歌词
let lyricsShowing = false;
ipcMain.handle("toggleLyrics", (_event, isShow) => {
	if (isShow || isShow === false) {lyricsShowing = !isShow;}
	if (lyricsShowing) {
		SimMusicWindows.lrcWin.webContents.send("setHidden", "text", true);
		setTimeout(() => {SimMusicWindows.lrcWin.hide();}, 100);
		lyricsShowing = false;
	} else {
		SimMusicWindows.lrcWin.show();
		SimMusicWindows.lrcWin.setIgnoreMouseEvents("true", {forward: true});
		SimMusicWindows.lrcWin.setSkipTaskbar(true);
		SimMusicWindows.lrcWin.setAlwaysOnTop(false);
		SimMusicWindows.lrcWin.setAlwaysOnTop(true);
		lyricsShowing = true;
		setTimeout(() => {SimMusicWindows.lrcWin.webContents.send("setHidden", "text", false);}, 400);
	}
	return lyricsShowing;
});
ipcMain.handle("lrcUpdate", (_event, lrc) => {
	SimMusicWindows.lrcWin.webContents.send("lrcUpdate", lrc);
});
ipcMain.handle("focusDesktopLyrics", () => {
	SimMusicWindows.lrcWin.setIgnoreMouseEvents(false);
});
ipcMain.handle("unfocusDesktopLyrics", () => {
	SimMusicWindows.lrcWin.setIgnoreMouseEvents(true, {forward: true});
});
ipcMain.handle("updateDesktopLyricsConfig", (_event, isProtected) => {
	SimMusicWindows.lrcWin.webContents.send("lrcWinReload");
	SimMusicWindows.lrcWin.setContentProtection(isProtected);
});



// 迷你模式
let isMiniMode = false;
ipcMain.handle("toggleMini", () => {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	SimMusicWindows.mainWin.hide();
	if (isMiniMode) {
		setTimeout(() => {
			SimMusicWindows.mainWin.setMinimumSize(1000, 700);
			SimMusicWindows.mainWin.setSize(1000, 700);
			SimMusicWindows.mainWin.setPosition(width / 2 - 500, height / 2 - 350);
			SimMusicWindows.mainWin.setResizable(true);
			SimMusicWindows.mainWin.setAlwaysOnTop(false);
			SimMusicWindows.mainWin.setSkipTaskbar(false);
			SimMusicWindows.mainWin.show();
		}, 500);
		return isMiniMode = false;
	} else {
		setTimeout(() => {
			SimMusicWindows.mainWin.unmaximize();
			SimMusicWindows.mainWin.setMinimumSize(340, 60);
			SimMusicWindows.mainWin.setSize(340, 60);
			SimMusicWindows.mainWin.setResizable(false);
			SimMusicWindows.mainWin.setAlwaysOnTop(true);
			SimMusicWindows.mainWin.setSkipTaskbar(true);
			SimMusicWindows.mainWin.setPosition(width - 360, height - 90);
			SimMusicWindows.mainWin.show();
		}, 500);
		return isMiniMode = true;
	}
});



// 主窗口调用
ipcMain.handle("pickFolder", () => {
	return dialog.showOpenDialogSync(SimMusicWindows.mainWin, {
		title: "选择目录 - SimMusic",
		defaultPath: "C:\\",
		buttonLabel: "使用此目录",
		properties: ["openDirectory"],
	});
});
ipcMain.handle("openDevtools", () => {
	SimMusicWindows.mainWin.webContents.openDevTools();
	// 傻逼谷歌搞个宋体当默认代码字体 怎么想的 给你眼珠子扣下来踩两脚
	SimMusicWindows.mainWin.webContents.once("devtools-opened", () => {
		const css = `
			:root {
				--sys-color-base: var(--ref-palette-neutral100);
				--source-code-font-family: consolas;
				--source-code-font-size: 12px;
				--monospace-font-family: consolas;
				--monospace-font-size: 12px;
				--default-font-family: system-ui, sans-serif;
				--default-font-size: 12px;
			}
			.-theme-with-dark-background {
				--sys-color-base: var(--ref-palette-secondary25);
			}
			body {
				--default-font-family: system-ui,sans-serif;
			}`;
		SimMusicWindows.mainWin.webContents.devToolsWebContents.executeJavaScript(`
			const overriddenStyle = document.createElement('style');
			overriddenStyle.innerHTML = '${css.replaceAll('\n', ' ')}';
			document.body.append(overriddenStyle);
			document.body.classList.remove('platform-windows');`);
	});
});