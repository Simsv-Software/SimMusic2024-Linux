// © 2020 - 2024  Simsv Studio

const { app, BrowserWindow, ipcMain, dialog, nativeImage, Tray, Menu, screen, session, webContents, desktopCapturer } = require("electron");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("enable-smooth-scrolling");
app.commandLine.appendSwitch("enable-features", "WindowsScrollingPersonality,FluentScrollbar,ParallelDownloading");

// Linux - 读取配置
const configPath = path.join(app.getPath("userData"), "config.json");
if (!fs.existsSync(configPath)) {
	fs.writeFileSync(configPath, "{}");
}

let deferredSaveConfig;
let immediatelySaveConfig;
const _confObj = JSON.parse(fs.readFileSync(configPath).toString());
const config = new Proxy(_confObj, {
	get: (obj, k) => obj.hasOwnProperty(k) ? obj[k] : null,
	set: (obj, k, v) => {
		obj[k] = v;
		deferredSaveConfig();
	}
});

// 创建窗口
const iconImage = nativeImage.createFromPath(path.join(__dirname, "frontend/assets/icon-blue.png"));
const SimMusicWindows = {};
let isMainWinLoaded;
let pendingOpenFile = [];
let tray;

function showMainWin() {
	SimMusicWindows.mainWin.show();
	if (SimMusicWindows.mainWin.isMinimized()) { SimMusicWindows.mainWin.restore(); }
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
		show: false,
		title: "SimMusic",
		backgroundColor: "#1E9FFF",
		titleBarStyle: "hidden",
		titleBarOverlay: {
			color: "#1E9FFF",
			symbolColor: "white",
			height: config.nativeHeaderButtons ? 35 : 1
		},
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false }
	});

	SimMusicWindows.mainWin.loadFile(path.join(__dirname, "frontend/main.html"));
	SimMusicWindows.mainWin.setIcon(iconImage);

	setTimeout(() => { SimMusicWindows.mainWin.show(); }, 50);

	SimMusicWindows.mainWin.on("close", e => {
		e.preventDefault();
		SimMusicWindows.mainWin.webContents.executeJavaScript("WindowOps.close()", true);
	});

	// 歌词窗体
	createLRCWindow();
}

// 桌面歌词
let lyricsShowing = false;
let lyricsLocked = false;
let musicPlaying = false;
const createLRCWindow = () => {
	SimMusicWindows.lrcWin = new BrowserWindow({
		x: config.lrcWinX,
		y: config.lrcWinY,
		width: config.lrcWinWidth ?? 700,
		height: config.lrcWinHeight ?? 80,
		frame: false,
		show: false,
		transparent: true,
		resizable: false,
		alwaysOnTop: true,
		backgroundThrottling: false,
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false }
	});

	SimMusicWindows.lrcWin.loadFile(path.join(__dirname, "frontend/lrc.html"));
	SimMusicWindows.lrcWin.on("close", () => {
		lyricsShowing = false;
		SimMusicWindows.mainWin.webContents.send("lrcWindowClosed");

		createLRCWindow();
	});

	SimMusicWindows.lrcWin.on("move", () => {
		const [x, y] = SimMusicWindows.lrcWin.getPosition();
		config.lrcWinX = x;
		config.lrcWinY = y;
	});
}

const applyLrcLock = (locked) => {
	SimMusicWindows.lrcWin.setIgnoreMouseEvents(locked ?? lyricsLocked);
};

const toggleLrcLock = () => {
	applyLrcLock(lyricsLocked = !lyricsLocked);
};

const processCliArg = (argv, pending) => {
	const lastArg = argv[argv.length - 1];
	if (fs.existsSync(lastArg) && !fs.statSync(lastArg).isDirectory()) {
		if (pending) {
			pendingOpenFile.push(lastArg);
		}

		return lastArg;
	}

	return null;
}

app.whenReady().then(() => {
	tray = new Tray(iconImage);
	tray.on("click", () => { showMainWin(); });
	tray.setToolTip("SimMusic");

	createWindow();

	if (!app.requestSingleInstanceLock()) {
		app.exit();
		return;
	}

	processCliArg(process.argv, true);

	app.on("second-instance", (_event, argv) => {
		if (isMainWinLoaded) {
			showMainWin();
		}

		// 缓存变量，防止第二次判断时更改
		const loaded = isMainWinLoaded;
		const file = processCliArg(argv, !loaded);
		if (file && loaded) {
			showMainWin();
			SimMusicWindows.mainWin.webContents.send("fileLaunch", file);
		}
	});

	app.on("before-quit", () => {
		immediatelySaveConfig();
	});

	session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
		desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
			callback({ video: sources[0], audio: "loopback" })
		});
	});
});

ipcMain.handle("mainWinLoaded", () => {
	if (isMainWinLoaded) return [];
	isMainWinLoaded = true;

	setTimeout(() => {
		SimMusicWindows.mainWin.setTitleBarOverlay({ color: "rgba(255,255,255,0)", symbolColor: "black" });
	}, 500);

	return pendingOpenFile;
});

// Linux start - 配置
(() => {
	let saveTimer;
	immediatelySaveConfig = () => {
		fs.writeFileSync(configPath, JSON.stringify(_confObj));
	}

	deferredSaveConfig = () => {
		// Debounce - improves efficiency
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => immediatelySaveConfig(), 1000);
	};

	ipcMain.handle("setConfig", (_, k, v) => {
		config[k] = v;
	});

	ipcMain.handle("getConfig", (_, k) => {
		return config[k];
	});

	// Save immediately
	ipcMain.handle("saveConfig", () => {
		save();
	});
})();
// Linux end

// Linux start - Overlay
ipcMain.handle("overlayColor", (_, inPlayer) => {
	SimMusicWindows.mainWin.setTitleBarOverlay({ color: "rgba(255,255,255,0)", symbolColor: inPlayer ? "rgba(255,255,255,.8)" : "black" });
});

ipcMain.handle("toggleOverlay", (_, enabled) => {
	SimMusicWindows.mainWin.setTitleBarOverlay({
		height: enabled ? 35 : 1
	});
});
// Linux end


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
		maximizable: false,
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false, devTools: false }
	});

	dialogWindow.loadFile(path.join(__dirname, 'frontend/assets/components/dialog.html'));
	dialogWindow.once("ready-to-show", () => {
		dialogWindow.webContents.send(
			"ready", JSON.stringify({
				type, txt, parent, dialogId: dialogId + '' /* Linux - fix error */
			}));

		dialogWindow.show();
	});
});
ipcMain.handle("dialogSubmit", async (_event, parent, dialogId, txt) => {
	if (dialogId.startsWith("wv")) {
		try {
			const cookies = await session.fromPartition("dialog-" + dialogId).cookies.get({});
			const json = JSON.stringify({
				cookies: cookies,
				url: txt,
			});
			SimMusicWindows[parent].webContents.send("dialogSubmit", dialogId, json);
		} catch {
			SimMusicWindows[parent].webContents.send("dialogSubmit", dialogId, "{}");
		}
	} else {
		SimMusicWindows[parent].webContents.send("dialogSubmit", dialogId, txt);
	}
});

ipcMain.handle("dialogCancel", (_event, parent) => {
	SimMusicWindows[parent].webContents.send("dialogCancel");
});
ipcMain.handle("webview", (_event, url, parent, dialogId, width, height, showFinishBtn) => {
	const dialogWindow = new BrowserWindow({
		parent: SimMusicWindows[parent],
		modal: true,
		width: width ?? 600,
		height: height ?? 500,
		minWidth: 600,
		minHeight: 500,
		frame: false,
		resizable: true,
		show: false,
		maximizable: true,
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false, webviewTag: true, devTools: false }
	});

	dialogWindow.loadFile(path.join(__dirname, 'frontend/assets/components/webview.html'));
	dialogWindow.center();
	dialogWindow.once("ready-to-show", () => {
		dialogWindow.webContents.send("ready", JSON.stringify({
			url, showFinishBtn, parent, dialogId: dialogId + ''
		}));

		dialogWindow.show();
	});
});
ipcMain.handle("webviewDialogLoaded", (_event, wcId) => {
	const wc = webContents.fromId(wcId);
	wc.setWindowOpenHandler(({ url }) => {
		wc.loadURL(url);
		return { action: "deny" }
	});
});
ipcMain.handle("modal", (_event, url, height, parent) => {
	const dialogWindow = new BrowserWindow({
		parent: SimMusicWindows[parent],
		modal: true,
		width: 500,
		height: height,
		frame: false,
		resizable: false,
		show: false,
		maximizable: false,
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false, devTools: false }
	});
	dialogWindow.loadFile(path.join(__dirname, "frontend/assets/components/", url));
	dialogWindow.once("ready-to-show", () => { dialogWindow.show(); });
});


// 任务栏控件
const createTaskbarButtons = () => {
	const isPlay = musicPlaying;

	SimMusicWindows.mainWin.setThumbarButtons([
		{
			tooltip: "上一首",
			icon: nativeImage.createFromPath(path.join(__dirname, "frontend/assets/misc/taskbar-prev.png")),
			click() { SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.prev(true)", true); }
		}, {
			tooltip: isPlay ? "暂停" : "播放",
			icon: nativeImage.createFromPath(path.join(__dirname, isPlay ? "frontend/assets/misc/taskbar-pause.png" : "frontend/assets/misc/taskbar-play.png")),
			click() { SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.togglePlay(true)", true); }
		}, {
			tooltip: "下一首",
			icon: nativeImage.createFromPath(path.join(__dirname, "frontend/assets/misc/taskbar-next.png")),
			click() { SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.next(true)", true); }
		}
	]);

	const menu = Menu.buildFromTemplate([
		{ label: "SimMusic", type: "normal", enabled: false },
		{ type: "separator" },
		{ label: "显示主窗口", type: "normal", click() { showMainWin(); } },
		{ label: isPlay ? "暂停" : "播放", type: "normal", click() { SimMusicWindows.mainWin.webContents.executeJavaScript("SimAPControls.togglePlay()", true); } },
		{
			label: lyricsLocked ? "解锁桌面歌词" : "锁定桌面歌词",
			type: "normal",
			click() {
				toggleLrcLock();
				createTaskbarButtons(isPlay);
			},
			enabled: lyricsShowing
		},
		{ type: "separator" },
		{ label: "退出应用", type: "normal", click: app.exit },
	]);

	tray.setContextMenu(menu);
}

ipcMain.handle("musicPlay", () => {
	if (lyricsShowing) SimMusicWindows.lrcWin.webContents.send("setHidden", "inside", false);
	musicPlaying = true;
	createTaskbarButtons();
	applyLrcLock();
});

ipcMain.handle("musicPause", () => {
	SimMusicWindows.lrcWin.webContents.send("setHidden", "inside", true);
	musicPlaying = false;
	createTaskbarButtons();
	applyLrcLock(true);
});


// 桌面歌词
ipcMain.handle("toggleLyrics", (_event, isShow) => {
	if (isShow || isShow === false) { lyricsShowing = !isShow; }

	if (lyricsShowing) {
		SimMusicWindows.lrcWin.webContents.send("setHidden", "text", true);
		setTimeout(() => SimMusicWindows.lrcWin.hide(), 100);
		lyricsShowing = false;
	} else {
		SimMusicWindows.lrcWin.show();
		lyricsShowing = true;
		setTimeout(() => SimMusicWindows.lrcWin.webContents.send("setHidden", "text", false), 400);
	}

	createTaskbarButtons();

	return lyricsShowing;
});

ipcMain.handle("lrcUpdate", (_event, lrc) => {
	SimMusicWindows.lrcWin.webContents.send("lrcUpdate", lrc);
});

ipcMain.handle("updateDesktopLyricsConfig", (_event, _isProtected) => {
	SimMusicWindows.lrcWin.webContents.send("lrcWinReload");
	// SimMusicWindows.lrcWin.setContentProtection(isProtected);
});

(() => {
	function update() {
		const width = config.lrcWinWidth ?? 700;
		const height = config.lrcWinHeight ?? 80;
		SimMusicWindows.lrcWin.setSize(width, height);
		SimMusicWindows.lrcWin.setContentSize(width, height);
	}

	ipcMain.handle("updateLrcWinWidth", (_, width) => {
		config.lrcWinWidth = width;
		update();
	});

	ipcMain.handle("updateLrcWinHeight", (_, height) => {
		config.lrcWinHeight = height > 0 ? height : 80;
		update();
	});
})();



// 迷你模式
let isMiniMode = false;
ipcMain.handle("toggleMini", () => {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	// SimMusicWindows.mainWin.setOpacity(0);
	if (isMiniMode) {
		setTimeout(() => {
			SimMusicWindows.mainWin.setMinimumSize(1000, 700);
			SimMusicWindows.mainWin.setSize(1000, 700);
			SimMusicWindows.mainWin.setPosition(parseInt(width / 2 - 500), parseInt(height / 2 - 350));
			SimMusicWindows.mainWin.setResizable(true);
			SimMusicWindows.mainWin.setHasShadow(true);
			SimMusicWindows.mainWin.setAlwaysOnTop(false);
			// SimMusicWindows.mainWin.setSkipTaskbar(false);
			// SimMusicWindows.mainWin.setOpacity(1);
			// SimMusicWindows.mainWin.setMinimizable(true);
			// SimMusicWindows.mainWin.setClosable(true);
			if (config.nativeHeaderButtons) {
				SimMusicWindows.mainWin.setTitleBarOverlay({ color: "rgba(255,255,255,0)", symbolColor: "black", height: 35 });
			}
		}, 50);
		return isMiniMode = false;
	} else {
		const miniHeight = config.decreaseMiniHeight ? 55 : 60;

		setTimeout(() => {
			SimMusicWindows.mainWin.unmaximize();
			SimMusicWindows.mainWin.setMinimumSize(340, miniHeight);
			SimMusicWindows.mainWin.setSize(340, miniHeight);
			SimMusicWindows.mainWin.setPosition(width - 360, height - 90);
			SimMusicWindows.mainWin.setResizable(false);
			SimMusicWindows.mainWin.setHasShadow(false);
			SimMusicWindows.mainWin.setAlwaysOnTop(true);
			// SimMusicWindows.mainWin.setSkipTaskbar(true);
			// SimMusicWindows.mainWin.setOpacity(.98);
			// SimMusicWindows.mainWin.setMinimizable(false);
			// SimMusicWindows.mainWin.setClosable(false);
			if (config.nativeHeaderButtons) {
				SimMusicWindows.mainWin.setTitleBarOverlay({ color: "rgba(0,0,0,0)", symbolColor: "rgba(255,255,255,0)", height: 1 });
			}
		}, 50);
		return isMiniMode = true;
	}
});




/*
// 文件格式关联
const fileRegAppId = "com.simsv.music";
const fileRegFileExt = [".mp3", ".flac", ".wav"];
const appPath = process.execPath;
const batchPath = path.join(os.tmpdir(), "sim-music-operations.bat");
const requestAdminCmd = `
@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
	powershell.exe -Command "Start-Process '%~0' -Verb RunAs"
	exit /B
)
`;
function registerFileExt(isReg) {
	let commands = requestAdminCmd;
	if (isReg) {
		commands += `REG ADD "HKEY_CLASSES_ROOT\\${fileRegAppId}\\shell\\open\\command" /ve /d "\\"${appPath}\\" \\"%%1\\"" /f\n`;
		commands += `REG ADD "HKEY_CLASSES_ROOT\\${fileRegAppId}\\DefaultIcon" /ve /d "\\"${path.dirname(appPath)}\\resources\\file-icon.ico\\",0" /f\n`;
		fileRegFileExt.forEach(ext => {
			commands += `REG ADD "HKEY_CLASSES_ROOT\\${ext}" /ve /d "${fileRegAppId}" /f\n`;
		});
	} else {
		commands += `REG DELETE "HKEY_CLASSES_ROOT\\${fileRegAppId}\\shell\\open\\command" /ve /f\n`;
	}
	fs.writeFileSync(batchPath, commands, { encoding: "utf-8" });
	try { exec(`cmd.exe /c "${batchPath}"`); } catch {}
}
ipcMain.handle("regFileExt", (_event, isReg) => {
	return registerFileExt(isReg);
});
*/

ipcMain.handle("regFileExt", (_event, isReg) => {
	// Unimplemented
});


// 本体更新
ipcMain.handle("appUpdate", () => {
	// Unimplemented
});



// 主窗口其他调用
ipcMain.handle("pickFolder", () => {
	return dialog.showOpenDialogSync(SimMusicWindows.mainWin, {
		title: "选择目录 - SimMusic",
		// defaultPath: "C:\\",
		buttonLabel: "使用此目录",
		properties: ["openDirectory"],
	});
});

ipcMain.handle("shutdownCountdown", () => {
	const countdown = new BrowserWindow({
		frame: false,
		resizable: false,
		kiosk: true,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		parent: SimMusicWindows.mainWin,
		modal: true,
		webPreferences: { webSecurity: false, nodeIntegration: true, contextIsolation: false }
	});
	countdown.loadFile(path.join(__dirname, "frontend/assets/components/shutdown.html"));
});

ipcMain.handle("cmd", (_event, cmd) => {
	exec(cmd);
});

ipcMain.handle("mainWinExec", (_event, js) => {
	SimMusicWindows.mainWin.webContents.executeJavaScript(js);
});

ipcMain.handle("openDevtools", () => {
	// SimMusicWindows.mainWin.webContents.openDevTools();
	SimMusicWindows.lrcWin.webContents.openDevTools();
});



