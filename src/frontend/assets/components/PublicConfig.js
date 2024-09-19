
const defaultEq = [ { F: 70, G: 0, Q: 1 }, { F: 180, G: 0, Q: 1 }, { F: 320, G: 0, Q: 1 }, { F: 600, G: 0, Q: 1 }, { F: 1000, G: 0, Q: 1 }, { F: 3000, G: 0, Q: 1 }, { F: 6000, G: 0, Q: 1 }, { F: 12000, G: 0, Q: 1 }, { F: 14000, G: 0, Q: 1 }, { F: 16000, G: 0, Q: 1 } ];

const defaultConfig = {
	musicLists: {},
	playList: [],
	currentMusic: null,
	volume: .8,
	loop: 0,
	headerButtonsDistance: 96,
	lrcShow: true,
	albumScale: true,
	musicFormats: ".mp3 .wav .flac",
	showLocator: true,
	themeImageType: "cover",
	backgroundBlur: true,
	audioFade: true,
	eqProfile: "basic",
	eqConfBasic: defaultEq,
	eqConfPro: defaultEq,
	sleepModePlayEnd: true,
	sleepModeOperation: "none",
	lyricBlur: true,
	lyricAlign: "left",
	lyricSize: 1.5,
	lyricTranslation: .8,
	lyricSpace: .5,
	lyricMultiLang: true,
	leftBarWidth: 200,
	autoDesktopLyrics: false,
	desktopLyricsProtection: true,
	desktopLyricsAutoHide: true,
	desktopLyricsColor: "#1E9FFF",
	desktopLyricsStrokeEnabled: true,
	desktopLyricsStroke: "#1672B8",
	desktopLyricsSize: 30,
	desktopLyricsWidth: 700,
	desktopLyricsTop: screen.height - 300,
	desktopLyricsLeft: screen.width / 2,
	ext: {},
	extPerms: {},
	musicListSort: [1, 1],
	parallelDownload: 3,
	downloadFileName: "[title] - [artist]",
	downloadMetadataTitle: true,
	downloadMetadataArtist: true,
	downloadMetadataCover: true,
	downloadMetadataLyrics: 1,
}

const configListeners = {};

const config = {
	getItem(key) {
		const data = localStorage.SimMusicConfig;
		if (!data) {
			localStorage.SimMusicConfig = "{}";
			return this.getItem(key);
		}
		try {
			const config = JSON.parse(data);
			if (config[key] || config[key] === false || config[key] === 0) return config[key];
			return defaultConfig[key];
		} catch {
			alert("配置文件损坏，程序将无法正常运行。");
		}
	},
	setItem(key, value) {
		const data = localStorage.SimMusicConfig;
		if (!data) {
			localStorage.SimMusicConfig = "{}";
			return this.setItem(key, value);
		}
		try {
			const config = JSON.parse(data);
			config[key] = value;
			const newConfig = JSON.stringify(config);
			localStorage.SimMusicConfig = newConfig;
		} catch {
			alert("配置文件损坏，程序将无法正常运行。");
		}
		if (configListeners[key]) configListeners[key](value);
	},
	listenChange(key, callback) {
		configListeners[key] = callback;
	}
}