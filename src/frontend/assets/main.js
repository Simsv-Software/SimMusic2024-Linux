SimMusicVersion = "0.1.2";


// 窗口处理
const WindowStatus = {
	maximized: false,
	lyricsWin: false,
};
const WindowOps = {
	close() {
		if (!config.getItem("disableBackground")) ipcRenderer.invoke("winOps", [document.documentElement.dataset.windowId, "hide"]);
		else ipcRenderer.invoke("quitApp");
	},
	maximize() {
		if (!WindowStatus.maximized) ipcRenderer.invoke("winOps", [document.documentElement.dataset.windowId, "maximize"]);
		else ipcRenderer.invoke("winOps", [document.documentElement.dataset.windowId, "unmaximize"]);
	},
	minimize() {
		ipcRenderer.invoke("winOps", [document.documentElement.dataset.windowId, "minimize"]);
	},
	toggleLyrics() {
		if (this.lyricsCooldown) return;
		this.lyricsCooldown = true;
		setTimeout(() => { this.lyricsCooldown = false; }, 500);
		ipcRenderer.invoke("toggleLyrics")
			.then(lyricsShow => {
				WindowStatus.lyricsWin = lyricsShow;
				document.getElementById("lyricsBtn").classList[lyricsShow ? "add" : "remove"]("active");
			});
	},
	toggleMini() {
		if (!document.body.classList.contains("withCurrentMusic")) return alert("当前没有正在播放的曲目。");
		ipcRenderer.invoke("toggleMini")
			.then(isMini => {
				document.body.classList[isMini ? "add" : "remove"]("miniMode");
			});
	},
};
document.body.onresize = () => {
	ipcRenderer.invoke("winOps", [document.documentElement.dataset.windowId, "isMaximized"])
		.then(isMaximized => {
			WindowStatus.maximized = isMaximized;
			document.getElementById("maximizeBtn").innerHTML = isMaximized ? "&#xeabb;" : "&#xeab9;";
		});
};
document.body.onresize();
document.documentElement.onkeydown = e => {
	if ((e.ctrlKey && ["i", "I", "r", "R"].includes(e.key)) || e.key == "Tab") e.preventDefault();
	if (document.activeElement.tagName.toLowerCase() == "input") return;
	e.preventDefault();
	if (document.activeElement.tagName.toLowerCase() == "input") return;
	switch (e.key.toLowerCase()) {
		case "w": config.setItem("desktopLyricsTop", Math.max(config.getItem("desktopLyricsTop") - 2, 0)); break;
		case "a": config.setItem("desktopLyricsLeft", Math.max(config.getItem("desktopLyricsLeft") - 2, 0)); break;
		case "s": config.setItem("desktopLyricsTop", Math.min(config.getItem("desktopLyricsTop") + 2, screen.height - 100)); break;
		case "d": config.setItem("desktopLyricsLeft", Math.min(config.getItem("desktopLyricsLeft") + 2, screen.width)); break;
	}
};
document.documentElement.ondragstart = e => { e.preventDefault(); };
document.getElementById("appVersion").textContent = SimMusicVersion;


// 公用函数
const SimMusicTools = {
	escapeHtml(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	},
	formatTime(time, hours = false) {
		let hoursValue = Math.floor(time / 3600);
		let hoursMinutes = Math.floor((time % 3600) / 60);
		let minutes = Math.floor(time / 60);
		let seconds = Math.floor(time % 60);
		if (hours) {
			return (!isNaN(hoursValue) && !isNaN(minutes) && !isNaN(seconds)) ? `${hoursValue ? (hoursValue + ":") : ""}${hoursMinutes < 10 ? "0" : ""}${hoursMinutes}:${seconds < 10 ? "0" : ""}${seconds}` : "--:--:--";
		} else {
			return (!isNaN(minutes) && !isNaN(seconds)) ? `${minutes}:${seconds < 10 ? "0" : ""}${seconds}` : "--:--";
		}
	},
	getTitleFromPath(path) {
		path = path.split("/")[path.split("/").length - 1];
		const lastDotIndex = path.lastIndexOf(".");
		if (lastDotIndex === -1 || lastDotIndex === 0) return path;
		return path.substring(0, lastDotIndex);
	},
	getDefaultAlbum(path) {
		const pathName = path.split("/")[path.split("/").length - 2];
		return pathName ?? "未知专辑";
	},
	initMusicIndex() {
		databaseRequest = indexedDB.open('MusicIndex', 1);
		databaseRequest.onsuccess = () => { this.MusicIndex = databaseRequest.result; };
		databaseRequest.onupgradeneeded = event => { event.target.result.createObjectStore("s", { keyPath: "k" }); };
	},
	readMusicIndex(callBack) {
		try {
			if (!this.MusicIndex) return setTimeout(() => { this.readMusicIndex(callBack); }, 50);
			this.MusicIndex.transaction('s').objectStore('s').get("MusicIndex").onsuccess = function (event) {
				let result = (event.target.result && event.target.result['v']) || [];
				callBack(result);
			};
		} catch (err) {
			alert("读取音频索引时出现问题。" + err);
		}
	},
	writeMusicIndex(value, callBack) {
		if (!this.MusicIndex) return setTimeout(() => { this.writeMusicIndex(value, callBack); }, 50);
		let txn = this.MusicIndex.transaction("s", "readwrite");
		txn.oncomplete = () => { if (callBack) callBack(); }
		txn.objectStore('s').put({ 'k': "MusicIndex", 'v': value });
		txn.commit();
	},
	getCoverUrl(arrayOrUrl) {
		if (typeof (arrayOrUrl) == "object") return URL.createObjectURL(new Blob([arrayOrUrl]));
		return arrayOrUrl;
	},
	getWindowsLegalName(original) {
		return original.replaceAll("\\", "_").replaceAll("/", "_").replaceAll(":", "：").replaceAll("*", "×").replaceAll("?", "？").replaceAll('"', "'").replaceAll("<", "《").replaceAll(">", "》").replaceAll("|", "丨").replaceAll("\n", "");
	},
	naturalSplit(string, filterCommonWords) {
		const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
		const iterator = segmenter.segment(string);
		return Array.from(iterator).map(obj => obj.segment.trim().toLowerCase()).filter(segment => {
			if (!filterCommonWords) return segment != "";
			return segment != "" && !["的", "大", "小", "了", "the", "a"].includes(segment);
		});
	}
};
SimMusicTools.initMusicIndex();


// 扩展运行环境
const ExtensionConfig = {};
const ExtensionRuntime = {
	async init() {
		const extData = await this.getExtData();
		for (const packageId in extData) {
			let extError;
			try {
				ExtensionConfig[packageId] = {};
				Function(extData[packageId].code)();
				if (ExtensionConfig[packageId].musicList) {
					const span = document.createElement("span");
					span.innerHTML = `
						<section class="title"><span>${extData[packageId].uiName}</span><i>&#xF4B2;</i></section>
						<section class="lists"></section>`;
					if (ExtensionConfig[packageId].musicList.add) {
						span.querySelector("i").onclick = () => {
							ExtensionConfig[packageId].musicList.add(() => {
								span.querySelector(".lists").innerHTML = "";
								ExtensionConfig[packageId].musicList.renderList(span.querySelector(".lists"));
							});
						}
					} else {
						span.querySelector("i").remove();
					}
					ExtensionConfig[packageId].musicList.renderList(span.querySelector(".lists"));
					document.getElementById("extBars").appendChild(span);
				}
			} catch (err) {
				extError = err;
			}
			const div = document.createElement("div");
			div.innerHTML = `
				<section>
					<div>${SimMusicTools.escapeHtml(extData[packageId].extName)}</div>
					<span>
						<i>&#xEE59;</i> 扩展包名: ${SimMusicTools.escapeHtml(packageId)}<br>
						<i>&#xEE51;</i> 扩展版本: ${SimMusicTools.escapeHtml(extData[packageId].version)}<br>
						${extError ? `<i>&#xEB97;</i> ${extError}` : ""}
					</span>
				</section>
				<button class="sub"${packageId == "file" ? " disabled" : ""}>卸载</button>`;
			div.querySelector("button").onclick = () => {
				this.uninstall(packageId);
			};
			document.getElementById("extensionContainer").appendChild(div);
		}

		SimMusicTools.readMusicIndex(index => {
			lastMusicIndex = index;
			ipcRenderer.invoke("mainWinLoaded").then(list => {
				if (list.length) {
					list = list.map(file => "file:" + file);
					updateMusicIndex(list, () => {
						PlayerController.switchMusicWithList(list[0], list, false, true);
					});
				} else {
					if (config.getItem("currentMusic") && lastMusicIndex[config.getItem("currentMusic")]) {
						PlayerController.switchMusicWithList(config.getItem("currentMusic"), config.getItem("playList"), false, true, true);
					} else {
						config.setItem("currentMusic", "");
					}
				}
				
				setTimeout(() => {
					document.body.classList.remove("appLoading");
				}, 500);
			});
		});
	},
	async install(file) {
		confirm("请确保扩展包来源可信，由攻击者提供的扩展可能会对您的系统执行恶意操作。", async () => {
			try {
				if (file.size > 256 * 1024) return alert("扩展包文件过大，请确保扩展包内仅包含必要的代码文件。");
				const arrBuffer = await file.arrayBuffer();
				const unzipped = fflate.unzipSync(new Uint8Array(arrBuffer));
				const manifestContent = fflate.strFromU8(unzipped["manifest.json"]);
				const manifest = JSON.parse(manifestContent);
				if (!manifest.packageId || !manifest.version || !manifest.extName) return alert("扩展清单字段数据不完整。");
				const packageId = manifest.packageId;
				let code = "";
				for (const i in manifest.entries) {
					const filename = manifest.entries[i];
					const jsCode = fflate.strFromU8(unzipped[filename]);
					code += jsCode + "\n";
				}
				const extData = config.getItem("ext");
				extData[packageId] = {
					version: manifest.version,
					extName: manifest.extName,
					uiName: manifest.uiName ?? manifest.extName,
					code: code,
				};
				config.setItem("ext", extData);
				alert("扩展已成功安装，按「确定」重载此应用生效。", () => {
					ipcRenderer.invoke("restart");
				});
			} catch (err) {
				console.warn(err);
				alert("扩展包已损坏、无法读取或存在未知错误。");
			}
		});
	},
	uninstall(packageId) {
		confirm("确实要卸载此扩展吗？卸载后由此扩展提供的曲目将无法正常播放，请慎重。", () => {
			const extData = config.getItem("ext");
			delete extData[packageId];
			config.setItem("ext", extData);
			alert("扩展已成功卸载，按「确定」重载此应用生效。", () => {
				ipcRenderer.invoke("restart");
			});
		});
	},
	async getExtData() {
		const extData = config.getItem("ext");
		extData["file"] = {
			code: await (await fetch("assets/components/LocalFolderExtension.js")).text(),
			uiName: "本地",
			extName: "本地文件播放支持",
			version: "1.0.0",
		}
		return extData;
	}
};
ExtensionRuntime.init();




// 左侧栏大小调整
document.getElementById("leftBarResizer").addEventListener("mousedown", e => {
	document.addEventListener("mousemove", resize);
	document.addEventListener("mouseup", stopResize);
	document.documentElement.style.cursor = "col-resize";
});
function resize(e) {
	let x = e.pageX;
	let distance = Math.max(150, Math.min(400, x));
	config.setItem("leftBarWidth", distance);
}
function stopResize() {
	document.removeEventListener("mousemove", resize);
	document.removeEventListener("mouseup", stopResize);
	document.documentElement.style.cursor = "";
}
config.listenChange("leftBarWidth", width => document.body.style.setProperty("--leftBarWidth", width + "px"));
document.body.style.setProperty("--leftBarWidth", config.getItem("leftBarWidth") + "px");

// 综合歌单
const MusicList = {
	add(callback) {
		prompt("请输入歌单名称 ...", name => {
			const lists = config.getItem("musicLists");
			name = name.trim();
			if (!name) return alert("请输入歌单名称。");
			if (lists[name]) return alert("此歌单已经存在，请更换名称。");
			lists[name] = [];
			config.setItem("musicLists", lists);
			if (callback) callback(name);
			MusicList.renderList();
			MusicList.switchList(name);
		});
	},
	renderList() {
		document.getElementById("musicLists").innerHTML = "";
		const lists = config.getItem("musicLists");
		for (const name in lists) {
			const element = document.createElement("div");
			element.textContent = name;
			element.dataset.listName = name;
			element.onclick = () => { this.switchList(name); };
			element.oncontextmenu = event => {
				new ContextMenu([
					{ label: "查看歌曲", click() { element.click(); } },
					{ type: "separator" },
					{
						label: "重命名", click() {
							prompt(`请为歌单「${name}」设置新名称...`, newName => {
								const lists = config.getItem("musicLists");
								let newList = {};
								for (const listName in lists) {
									newList[(listName == name) ? newName : listName] = lists[listName];
								}
								config.setItem("musicLists", newList);
								MusicList.renderList();
								MusicList.switchList(newName);
							});
						}
					},
					{
						label: "删除歌单", click() {
							confirm(`歌单「${name}」将被永久删除，但这不会影响到歌单中的文件。是否继续？`, () => {
								const lists = config.getItem("musicLists");
								delete lists[name];
								config.setItem("musicLists", lists);
								if (element.classList.contains("active")) switchRightPage("rightPlaceholder");
								element.remove();
							});
						}
					},
				]).popup([event.clientX, event.clientY]);
			};
			document.getElementById("musicLists").appendChild(element);
		}
	},
	switchList(name, force) {
		const lists = config.getItem("musicLists");
		renderMusicList(lists[name], {
			uniqueId: "musiclist-" + name,
			errorText: "拖入文件以导入歌单",
			menuItems: [
				{
					type: ["single", "multiple"], content: {
						label: "从歌单中移除", click() {
							const files = getCurrentSelected();
							const confirmDelete = () => {
								files.forEach(file => {
									const lists = config.getItem("musicLists");
									lists[name].splice(lists[name].indexOf(file), 1);
									config.setItem("musicLists", lists);
								});
								document.querySelectorAll("#musicListContainer>.show .musicListContent>tr.selected").forEach(ele => ele.remove());
								document.querySelector("#musicListContainer>.show").dataset.fileLength = -1;
							}
							if (files.length > 4) confirm(`确实要从歌单「${name}」删除这 ${files.length} 首曲目吗？`, confirmDelete);
							else confirmDelete();
						}
					}
				}
			],
			musicListInfo: { name: name },
			force: force
		});
		document.querySelectorAll(".left .leftBar div").forEach(ele => {
			if (ele.dataset.listName != name) ele.classList.remove("active");
			else ele.classList.add("active");
		});
	},
	getMenuItems(callback) {
		const array = [];
		const lists = config.getItem("musicLists");
		for (const name in lists) {
			array.push({
				label: name,
				click: () => { callback(name); }
			});
		}
		if (Object.keys(lists).length) array.push(({ type: "separator" }));
		array.push(({ label: "创建新歌单", click: () => { this.add(callback); } }));
		return array;
	},
	importToMusicList(name, files) {
		const lists = config.getItem("musicLists");
		if (!lists[name]) return;
		files.forEach(file => {
			if (!lists[name].includes(file)) lists[name].push(file);
		});
		config.setItem("musicLists", lists);
		unselectAll();
	}
};
MusicList.renderList();



// 歌曲&扩展包拖放
document.documentElement.ondragover = e => {
	e.preventDefault();
	if ((document.getElementById("extensionPage").hidden) &&
		(document.getElementById("musicListContainer").hidden ||
			!document.querySelector("#musicListContainer>.show") ||
			!document.querySelector("#musicListContainer>.show").dataset.musicListId.startsWith("musiclist-"))
	) return;
	if (e.dataTransfer.types.includes("Files")) {
		document.body.classList.add("dragOver");
		document.getElementById("dropTip").style.left = e.clientX + 10 > document.documentElement.clientWidth - 160 ? document.documentElement.clientWidth - 165 : e.clientX + 10 + "px";
		document.getElementById("dropTip").style.top = e.clientY + 30 + "px";
		document.getElementById("dropTipText").textContent = document.getElementById("musicListContainer").hidden ? "松手安装扩展" : "松手加入当前歌单";
	}
};
document.documentElement.ondrop = e => {
	e.preventDefault();
	if ((document.getElementById("extensionPage").hidden) &&
		(document.getElementById("musicListContainer").hidden ||
			!document.querySelector("#musicListContainer>.show") ||
			!document.querySelector("#musicListContainer>.show").dataset.musicListId.startsWith("musiclist-"))
	) return;
	document.body.classList.remove("dragOver");
	if (e.dataTransfer.types.includes("Files")) {
		if (!document.getElementById("musicListContainer").hidden) {
			const currentMusicList = document.querySelector("#musicListContainer>.show").dataset.musicListId;
			let files = [];
			const supportedExtensions = config.getItem("musicFormats").split(" ");
			for (let i = 0; i < e.dataTransfer.files.length; i++) {
				const file = e.dataTransfer.files[i];
				const fullPath = file.path;
				const ext = path.extname(fullPath).toLowerCase();
				if (supportedExtensions.includes(ext)) files.push("file:" + fullPath);
			}
			const name = currentMusicList.substring(10);
			MusicList.importToMusicList(name, files);
			MusicList.switchList(name, true);
		} else {
			const file = e.dataTransfer.files[0];
			ExtensionRuntime.install(file);
		}
	}
};
document.documentElement.ondragleave = () => {
	document.body.classList.remove("dragOver");
};



// 音乐搜索
Search = {
	async switchSearch() {
		if (document.getElementById("searchBtn").classList.contains("active")) return;
		document.getElementById("searchSubmitBtn").disabled = false;
		document.querySelectorAll(".left .leftBar div").forEach(ele => ele.classList.remove("active"));
		document.getElementById("searchBtn").classList.add("active");
		const searchSource = document.getElementById("searchSource");
		if (!searchSource.innerHTML) {
			const extData = await ExtensionRuntime.getExtData();
			for (const name in ExtensionConfig) {
				if (ExtensionConfig[name].search) {
					searchSource.innerHTML += `<option value="${name}">${SimMusicTools.escapeHtml(extData[name].uiName)}</option>`;
				}
			}
			document.getElementById("searchInput").onkeydown = e => {
				if (e.key === "Tab") {
					var currentOption = searchSource.options[searchSource.selectedIndex];
					var nextOption = currentOption.nextElementSibling;
					if (nextOption) searchSource.selectedIndex = searchSource.selectedIndex + 1;
					else searchSource.selectedIndex = 0;
				}
			}
		}
		switchRightPage("musicListContainer");
		musicListContainer.querySelectorAll("div[data-music-list-id]").forEach(div => {
			div.classList[div.dataset.musicListId == "search" ? "add" : "remove"]("show");
		});
		document.getElementById("searchInput").select();
		if (!this.searched) {
			showErrorOverlay("还未发起搜索");
			document.getElementById("searchBottomIndicator").style.opacity = 0;
		}
	},
	submit() {
		this.searched = true;
		if (event) event.preventDefault();
		const ext = document.getElementById("searchSource").value;
		const keyword = document.getElementById("searchInput").value;
		if (!keyword) return alert("请输入搜索关键字。");
		if (keyword == "OPENDEVTOOLS") {
			ipcRenderer.invoke("openDevtools");
			config.setItem("devMode", 1);
			return document.getElementById("searchInput").value = "";
		}
		const btn = document.getElementById("searchSubmitBtn");
		btn.disabled = true;
		this.currentSearchKeyword = keyword;
		setTimeout(() => {
			ExtensionConfig[ext].search(keyword, 0)
				.then((data) => {
					if (!btn.disabled) return;
					this.searchPage = 0;
					this.hasMore = data.hasMore;
					this.currentSearchExt = ext;
					renderMusicList(data.files ?? [], {
						uniqueId: "search",
						dontRenderBeforeLoaded: true,
						errorText: "暂无搜索结果",
						menuItems: data.menu ?? [],
						force: true,
						highlightWords: SimMusicTools.naturalSplit(keyword),
						finishCallback() { Search.loadIndicatorStatus(); btn.disabled = false; }
					});
					document.getElementById("searchBottomIndicator").dataset.status = "";
				})
				.catch(err => {
					if (!btn.disabled) return;
					Search.hasMore = false;
					Search.loadIndicatorStatus();
					showErrorOverlay(err);
				});
		}, 200);
	},
	loadMore() {
		if (this.hasMore) {
			const searchBottomIndicator = document.getElementById("searchBottomIndicator");
			if (searchBottomIndicator.dataset.status == "loading") return;
			document.getElementById("searchBottomIndicator").style = "";
			searchBottomIndicator.dataset.status = "loading";
			searchBottomIndicator.textContent = "正在加载更多...";
			const currentKeyword = this.currentSearchKeyword;
			setTimeout(() => {
				ExtensionConfig[this.currentSearchExt].search(currentKeyword, this.searchPage + 1)
					.then((data) => {
						if (this.currentSearchKeyword != currentKeyword) return;
						searchBottomIndicator.dataset.status = "";
						renderMusicList(getCurrentMusicList().concat(data.files ?? []), {
							uniqueId: "search",
							dontRenderBeforeLoaded: true,
							errorText: "暂无搜索结果",
							menuItems: data.menu ?? [],
							force: true,
							finishCallback: this.loadIndicatorStatus,
							highlightWords: SimMusicTools.naturalSplit(currentKeyword),
						});
						this.searchPage++;
						this.hasMore = data.hasMore;
					})
					.catch(() => {
						this.hasMore = false;
						this.loadIndicatorStatus();
					});
			}, 200);
		} else {
			this.hasMore = false;
			this.loadIndicatorStatus();
		}
	},
	loadIndicatorStatus() {
		document.getElementById("searchBottomIndicator").style = "";
		if (document.querySelector("#musicListContainer>.show .musicListErrorOverlay").hidden) document.getElementById("searchBottomIndicator").textContent = Search.hasMore ? "点击加载更多" : "暂无更多搜索结果";
	}
}
new IntersectionObserver((entries) => {
	entries.forEach(entry => {
		if (entry.isIntersecting && Search.searched) Search.loadMore();
	});
}).observe(document.getElementById("searchBottomIndicator"));


// 右侧列表界面
// 为提高性能，先用缓存的信息渲染，然后再获取没获取过的元数据
let lastMusicIndex = {};
function switchRightPage(id) {
	if (id != "musicListContainer") {
		document.querySelectorAll(".left .leftBar div").forEach(ele => {
			if (ele.dataset.pageId != id) ele.classList.remove("active");
			else ele.classList.add("active");
		});
	}
	document.querySelectorAll(".right>div").forEach(div => div.hidden = true);
	document.getElementById(id).hidden = false;
}
const coverObserver = new IntersectionObserver((entries) => {
	entries.forEach(entry => {
		if (entry.isIntersecting && !entry.target.dataset.coverShown) {
			entry.target.dataset.coverShown = 1;
			const coverData = lastMusicIndex[entry.target.dataset.file] ? lastMusicIndex[entry.target.dataset.file].cover : null;
			if (!coverData) return;
			const img = entry.target.querySelector("img");
			img.src = SimMusicTools.getCoverUrl(coverData);
			img.onload = () => { reloadMusicListCover(); }
		}
	});
});
function showErrorOverlay(err) {
	document.querySelector("#musicListContainer>.show .musicListContent").innerHTML = "";
	document.querySelector("#musicListContainer>.show .musicListErrorOverlay").hidden = false;
	document.querySelector("#musicListContainer>.show .musicListErrorOverlay>div").textContent = err;
	document.getElementById("searchSubmitBtn").disabled = false;
	document.getElementById("searchBottomIndicator").textContent = "";
}
function renderMusicList(files, args, isFinalRender) {
	if (!args.errorText) args.errorText = "当前歌单为空";
	if (!args.menuItems) args.menuItems = [];
	if (!args.musicListInfo) args.musicListInfo = {};
	// 获取或创建当前的歌单容器
	const musicListContainer = document.getElementById("musicListContainer");
	let containerElement, templateElement;
	musicListContainer.querySelectorAll("div[data-music-list-id]").forEach(div => {
		div.classList.remove("show");
		if (div.dataset.musicListId == "template") templateElement = div;
		if (div.dataset.musicListId == args.uniqueId) containerElement = div;
	});
	if (!containerElement) {
		containerElement = templateElement.cloneNode(true);
		containerElement.dataset.musicListId = args.uniqueId;
		musicListContainer.appendChild(containerElement);
	}
	containerElement.classList.add("show");
	// 获取或创建当前的音乐列表
	let musicListContent = containerElement.querySelector(".musicListContent");
	if (!musicListContent) {
		musicListContent = templateElement.querySelector(".musicListContent").cloneNode(true);
		containerElement.appendChild(musicListContent);
	}
	// 首次渲染
	if (!isFinalRender) {
		// 切换页面
		if (args.uniqueId != "search") switchRightPage("musicListContainer");
		unselectAll();
		if (args.uniqueId != "search") {
			// 渲染歌单顶部信息栏
			containerElement.querySelector(".musicListName").textContent = args.musicListInfo.name ?? "歌单标题";
			containerElement.querySelector(".folderDir").hidden = !args.musicListInfo.dirName;
			containerElement.querySelector(".musicListDir").textContent = args.musicListInfo.dirName;
			containerElement.querySelector(".musicListNum").textContent = files.length;
			// 防止重复渲染 提升性能
			if (files.length == containerElement.dataset.fileLength && !args.force) return;
			containerElement.dataset.fileLength = files.length;
			// 清空容器，搜索除外
			musicListContent.innerHTML = "";
		}
	}
	// 处理一些其他元素
	if (isFinalRender || !args.dontRenderBeforeLoaded) {
		containerElement.querySelector(".musicListErrorOverlay").hidden = true;
		document.getElementById("searchSubmitBtn").disabled = false;
	}
	// 读取索引并渲染列表
	SimMusicTools.readMusicIndex(musicIndex => {
		const renderObject = [];
		lastMusicIndex = musicIndex;
		if (!isFinalRender) {
			updateMusicIndex(files, () => { renderMusicList(files, args, true); });
			if (args.dontRenderBeforeLoaded) return;
		} else {
			if (args.finishCallback) args.finishCallback();
		}
		files.forEach(name => {
			if (musicIndex[name]) renderObject.push([name, musicIndex[name]]);
			else renderObject.push([name, {}]);
		});
		musicListContent.innerHTML = "";
		let totalTime = 0;
		// 歌曲高亮
		const highlightProcess = args.highlightWords ? html => {
			const regexParts = args.highlightWords.reduce((acc, keyword) => {
				// 小于3个字符的西文字母 全词匹配
				if (keyword.length < 3 && /^[A-Za-z]+$/.test(keyword)) acc.shortKeywords.push("\\b" + keyword + "\\b");
				else acc.longKeywords.push(keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
				return acc;
			}, { shortKeywords: [], longKeywords: [] });
			const keywordRegex = new RegExp(regexParts.shortKeywords.concat(regexParts.longKeywords).join("|"), "gi");
			let highlightedText = html.replace(keywordRegex, "<m>$&</m>");
			highlightedText = highlightedText.replaceAll("</m> <m>", " ");
			return highlightedText;
		} : html => { return html; }
		const maxIndexDigits = renderObject.length.toString().length;
		renderObject.forEach((music, originalIndex) => {
			// 创建元素
			let tr;
			tr = document.createElement("tr");
			tr.dataset.file = music[0];
			if (isFinalRender) coverObserver.observe(tr);
			const htmlTitle = SimMusicTools.escapeHtml(music[1].title ?? SimMusicTools.getTitleFromPath(music[0]));
			const htmlArtist = SimMusicTools.escapeHtml(music[1].artist ?? "正在读取");
			const htmlAlbum = SimMusicTools.escapeHtml(music[1].album ?? SimMusicTools.getDefaultAlbum(music[0]));
			tr.innerHTML = `
				<td><img src="assets/placeholder.svg" onerror="this.src='assets/placeholder.svg'"></td>
				<td>${highlightProcess(htmlTitle)}</td>
				<td>${highlightProcess(htmlArtist)}</td>
				<td>${highlightProcess(htmlAlbum)}</td>
				<td>${SimMusicTools.formatTime(music[1].time)}</td>
				<td hidden>${originalIndex.toString().padStart(maxIndexDigits, "0")}</td>`;
			// 绑定点击事件
			if (isFinalRender) {
				tr.oncontextmenu = e => {
					if (!tr.classList.contains("selected")) tr.click();
					handleMusicContextmenu(e, args.menuItems);
				};
				tr.onclick = e => {
					e.stopPropagation();
					const allTrs = Array.from(musicListContent.querySelectorAll("tr"));
					const lastSelectedElement = musicListContent.querySelector("tr.selected");
					if (e.ctrlKey) {
						if (tr.classList.contains("selected")) tr.classList.remove("selected");
						else tr.classList.add("selected");
					} else if (e.shiftKey && lastSelectedElement) {
						const indexLastSelected = allTrs.indexOf(lastSelectedElement);
						const indexCurrentSelected = allTrs.indexOf(tr);
						var start = Math.min(indexLastSelected, indexCurrentSelected);
						var end = Math.max(indexLastSelected, indexCurrentSelected);
						const selectedTrs = allTrs.slice(start, end + 1);
						selectedTrs.forEach(tr => tr.classList.add("selected"));
					} else {
						allTrs.forEach(tr => tr.classList.remove("selected"));
						tr.classList.add("selected");
					}
				}
				tr.ondblclick = () => {
					tr.classList.remove("selected");
					PlayerController.switchMusicWithList(music[0], getCurrentMusicList());
				};
			}
			// 统计音乐时间
			if (music[1].time) totalTime += music[1].time;
			// 加入列表
			musicListContent.appendChild(tr);
		});
		// 排序相关
		if (args.uniqueId != "search") {
			const headCells = containerElement.querySelectorAll("thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4)");
			headCells.forEach(th => {
				th.onclick = () => { setMusicListSort(th.cellIndex); };
			});
			loadMusicListSort();
		}
		// 其他处理
		if (isFinalRender && args.uniqueId != "search") containerElement.querySelector(".musicListTime").textContent = SimMusicTools.formatTime(totalTime, true);
		if (!musicListContent.innerHTML) showErrorOverlay(args.errorText);
		PlayerController.loadMusicListActive();
		containerElement.onclick = () => { musicListContent.querySelectorAll("tr").forEach(tr => tr.classList.remove("selected")); };
		reloadMusicListCover();
	});
}
function setMusicListSort(thIndex) {
	let current = config.getItem("musicListSort");
	if (current[0] == thIndex) {
		current[1]++;
		if (current[1] == 2) current = [5, 0];
	}
	else current = [thIndex, 0];
	config.setItem("musicListSort", current);
	loadMusicListSort();
}
function loadMusicListSort(restoreOrder) {
	const allTables = document.querySelectorAll(`#musicListContainer>div:not([data-music-list-id="search"]) table`);
	let sortConfig = config.getItem("musicListSort");
	// 进行排序前 先恢复一下原始顺序
	if (!restoreOrder) loadMusicListSort(true);
	else {
		if (sortConfig[1] != 5) sortConfig = [5, 0];
		else return;
	}
	const rowIndex = sortConfig[0];
	const rowSortNum = sortConfig[1] ? -1 : 1;
	for (const table of allTables) {
		table.querySelectorAll("thead th").forEach(th => {
			th.classList.remove("positiveOrder");
			th.classList.remove("reversedOrder");
			if (th.cellIndex == rowIndex) th.classList.add(sortConfig[1] ? "reversedOrder" : "positiveOrder");
		});
		const tBody = table.tBodies[0];
		const rows = Array.from(tBody.rows);
		rows.sort((tr1, tr2) => {
			const tr1Text = tr1.cells[rowIndex].textContent;
			const tr2Text = tr2.cells[rowIndex].textContent;
			return rowSortNum * tr1Text.localeCompare(tr2Text);
		});
		tBody.append(...rows);
	}
	reloadMusicListCover();
}
function updateMusicIndex(allFiles, callback) {
	const existedFiles = Object.keys(lastMusicIndex);
	const files = allFiles.filter(file => !existedFiles.includes(file));
	let finished = -1;
	const record = () => {
		finished++;
		if (!files.length) callback();
		else if (finished == files.length) SimMusicTools.writeMusicIndex(lastMusicIndex, () => { callback(); });
	}
	files.forEach(file => {
		const updateMusicIndex = (data) => {
			if (!data) data = {};
			lastMusicIndex[file] = {
				title: data.title ? data.title : SimMusicTools.getTitleFromPath(file),
				artist: data.artist ? data.artist : "未知艺术家",
				album: data.album ? data.album : SimMusicTools.getDefaultAlbum(file),
				time: data.time,
				cover: data.cover ? data.cover : "",
				lyrics: data.lyrics,
			};
			record();
		};
		try {
			const scheme = file.split(":")[0];
			ExtensionConfig[scheme].readMetadata(file).then(updateMusicIndex).catch(updateMusicIndex);
		} catch (err) {
			updateMusicIndex();
		}
	});
	record();
}
function reloadMusicListCover() {
	document.querySelectorAll("#musicListContainer>div").forEach(div => {
		let musicListCover = div.querySelector(".musicListCover")
		const img = div.querySelector(".musicListContent>tr:first-child>td:first-child>img");
		if (!musicListCover || !img) return;
		let currentCover = img.src;
		if (musicListCover.src != currentCover) {
			musicListCover.src = currentCover;
		}
	});
}
function getCurrentMusicList() {
	return Array.from(document.querySelectorAll("#musicListContainer>.show .musicListContent>tr")).map(tr => tr.dataset.file);
}
function getCurrentSelected() {
	return Array.from(document.querySelectorAll("#musicListContainer>.show .musicListContent>tr.selected")).map(tr => tr.dataset.file);
}
function unselectAll() {
	document.getElementById("musicListContainer").querySelectorAll("tr").forEach(tr => tr.classList.remove("selected"));
}
function handleMusicContextmenu(event, extraMenu = []) {
	const list = getCurrentMusicList();
	const files = getCurrentSelected();
	if (!files.length) return;
	const singleFileOptions = [
		{ label: "开始播放", click() { PlayerController.switchMusicWithList(files[0], list, true); } },
		{ label: "下一首播放", click() { PlayerController.appendPlayList(files[0], true); } },
	]
	const multiFileOptions = [
		{ label: "在当前曲目后播放", click() { PlayerController.appendPlayList(files, true); } },
		{ label: "添加到当前播放列表", click() { PlayerController.appendPlayList(files); } },
		{ label: "替换当前播放列表", click() { PlayerController.switchMusicWithList(files[0], files, true); } },
	]
	const commonOptions = [
		{ type: "separator" },
		{ label: "添加到歌单", submenu: MusicList.getMenuItems(name => { MusicList.importToMusicList(name, files); }) },
	];
	const basicOptions = (files.length == 1 ? singleFileOptions : multiFileOptions).concat(commonOptions);
	let extraOptions = [];
	extraMenu.forEach(menu => {
		if (files.length == 1 && menu.type.includes("single")) extraOptions.push(menu.content);
		else if (files.length != 1 && menu.type.includes("multiple")) extraOptions.push(menu.content);
	});
	new ContextMenu(basicOptions.concat(extraOptions)).popup([event.clientX, event.clientY]);
}



// 播控核心
const PlayerController = {
	// 替换列表并播放
	switchMusicWithList(file, list, showAP, isInit, audioPause) {
		if (!list.length) return;
		if (document.body.classList.contains("musicLoading")) return;
		if (config.getItem("loop") == 2) {
			list = list.sort(() => Math.random() - 0.5);
			if (file) {
				const currentPlayingIndex = list.indexOf(file);
				const currentFirst = list[0];
				list[0] = list[currentPlayingIndex];
				list[currentPlayingIndex] = currentFirst;
			}
		}
		this.replacePlayList(list);
		this.switchMusic(file ? file : list[0], isInit, false, audioPause)
			.then(() => { if (showAP) SimAPUI.show(); });
	},
	// 切歌
	async switchMusic(file, isInit, forceSwitch, audioPause) {
		if (!config.getItem("playList").includes(file)) return;
		if (document.body.classList.contains("musicLoading")) return;
		if (config.getItem("currentMusic") == file && !isInit && !forceSwitch) {
			SimAPUI.show();
			return document.getElementById("audio").play();
		}
		document.getElementById("audio").pause();
		config.setItem("currentMusic", file);
		this.loadMusicListActive();
		const fileScheme = file.split(":")[0];
		if (!ExtensionConfig[fileScheme] || !ExtensionConfig[fileScheme].player || !ExtensionConfig[fileScheme].player.getPlayUrl || !ExtensionConfig[fileScheme].player.getLyrics) {
			shell.beep();
			return confirm("播放此曲目所需的扩展程序已损坏或被删除，是否将其从播放列表中移除？", () => {
				PlayerController.deleteFromList(config.getItem("currentMusic"));
			});
		}
		// 这里是为了防止音频timeupdate事件撅飞加载动画
		setTimeout(async () => {
			SimAPProgress.setValue(0);
			SimAPProgressBottom.setValue(0);
			document.body.classList.add("musicLoading");
			const metadata = lastMusicIndex[file];
			switchMusic({
				album: metadata.cover ? SimMusicTools.getCoverUrl(metadata.cover) : "assets/placeholder.svg",
				title: metadata.title,
				artist: metadata.artist,
				audio: await ExtensionConfig[fileScheme].player.getPlayUrl(file),
				lyrics: metadata.lyrics ? metadata.lyrics : await ExtensionConfig[fileScheme].player.getLyrics(file),
				play: !audioPause,
			});
		}, 50);
	},
	// 替换列表
	replacePlayList(list) {
		config.setItem("playList", list);
		this.renderPlaylist();
	},
	// 渲染列表
	renderPlaylist() {
		document.getElementById("playList").innerHTML = "";
		config.getItem("playList").forEach(file => {
			const div = this.createListElement(file);
			if (div) document.getElementById("playList").appendChild(div);
		});
		this.loadMusicListActive();
	},
	// 下一首播放或者插入列表最后
	appendPlayList(fileOrList, toNext = false) {
		if (fileOrList.forEach) {
			if (config.getItem("loop") == 2) fileOrList = fileOrList.sort(() => Math.random() - 0.5);
			fileOrList.forEach(file => { this.appendPlayList(file, toNext); });
			return;
		}
		const syncListFromDivs = () => { config.setItem("playList", Array.from(document.querySelectorAll("#playList>div")).map(div => div.dataset.file)); }
		const list = config.getItem("playList");
		const file = fileOrList;
		const activeDiv = document.querySelector("#playList>div.active");
		if (list.includes(file)) {
			if (toNext) {
				if (file == config.getItem("currentMusic")) return SimAPUI.show();
				const divs = document.querySelectorAll("#playList>div");
				if (!activeDiv) return alert("当前没有正在播放的曲目。");
				divs.forEach(div => {
					if (div.dataset.file == file) activeDiv.insertAdjacentElement("afterend", div);
				});
				syncListFromDivs();
			}
		} else {
			const div = this.createListElement(file);
			if (!div) return;
			if (!activeDiv) return alert("当前没有正在播放的曲目。");
			if (toNext) activeDiv.insertAdjacentElement("afterend", div);
			else document.getElementById("playList").appendChild(div);
			syncListFromDivs();
		}
		SimAPControls.toggleList(1);
		SimAPUI.show();
	},
	// 创建列表元素（用于渲染列表&插入下一首播放）
	createListElement(file) {
		if (!lastMusicIndex[file]) return;
		const div = document.createElement("div");
		div.innerHTML = `
			<img src="assets/placeholder.svg" onerror="this.src='assets/placeholder.svg'">
			<div><b>${SimMusicTools.escapeHtml(lastMusicIndex[file].title)}</b><span>${SimMusicTools.escapeHtml(lastMusicIndex[file].artist)}</span></div>
			<i>&#xF4C8;</i>
		`;
		div.dataset.file = file;
		div.onclick = () => { this.switchMusic(file); }
		div.querySelector("i").onclick = e => {
			e.stopPropagation();
			this.deleteFromList(file);
		};
		coverObserver.observe(div);
		return div;
	},
	// 从列表中删除
	deleteFromList(file) {
		document.querySelectorAll("#playList>div").forEach(currentDiv => {
			if (currentDiv.dataset.file == file) {
				const div = currentDiv;
				const list = config.getItem("playList");
				list.splice(list.indexOf(file), 1);
				config.setItem("playList", list);
				div.classList.add("removed");
				setTimeout(() => { div.remove(); }, 400);
				if (file == config.getItem("currentMusic")) {
					if (!list.length) {
						config.setItem("currentMusic", "");
						SimAPUI.hide();
						if (document.body.classList.contains("miniMode")) WindowOps.toggleMini();
						document.body.classList.remove("withCurrentMusic");
						document.getElementById("audio").remove();
						const audio = document.createElement("audio");
						audio.id = "audio";
						document.body.appendChild(audio);
						loadVolumeUi();
					} else {
						SimAPControls.next();
					}
					this.loadMusicListActive();
				}
				return;
			}
		});
	},
	// 渲染歌单界面播放中歌曲
	loadMusicListActive() {
		const currentMusic = config.getItem("currentMusic");
		document.querySelectorAll(".musicListContent>tr").forEach(tr => {
			tr.classList[tr.dataset.file == currentMusic ? "add" : "remove"]("active");
		})
		document.querySelectorAll("#playList>div").forEach(div => {
			if (div.dataset.file == currentMusic) {
				div.classList.add("active");
				if (!PlayerController.listScrollLock) {
					PlayerController.listScrollLock = true;
					setTimeout(() => { div.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100);
					setTimeout(() => { PlayerController.listScrollLock = false; }, 500);
				}
			} else div.classList.remove("active");
		})
	}
}
if (!config.getItem("lrcShow")) document.body.classList.add("hideLyrics");
const loadPlayColor = () => { document.body.classList[config.getItem("playBtnColor") ? "add" : "remove"]("playBtnColor"); }
config.listenChange("playBtnColor", loadPlayColor); loadPlayColor();
const load3dEffect = () => { document.body.classList[config.getItem("3dEffect") ? "add" : "remove"]("threeEffect"); }
config.listenChange("3dEffect", load3dEffect); load3dEffect();
if (config.getItem("devMode", 1)) document.getElementById("devBtn").hidden = false;



// 歌曲下载
const DownloadController = {
	getMenuItems() {
		const array = [];
		const lists = config.getItem("folderLists");
		lists.forEach(name => array.push({
			label: name,
			click: () => { DownloadController.addTask(name); }
		}));
		if (lists.length) array.push(({ type: "separator" }));
		array.push(({
			label: Object.keys(lists).length ? "选择其他目录" : "选择目录",
			click: () => { ipcRenderer.invoke("pickFolder").then(dir => { DownloadController.addTask(dir); }); }
		}));
		return { type: ["single", "multiple"], content: { label: "下载到本地", submenu: array }, };
	},
	addTask(destination) {
		const files = getCurrentSelected();
		updateMusicIndex(files, () => {
			const downloadContainer = document.getElementById("downloadContainer");
			files.forEach(file => {
				if (lastMusicIndex[file]) {
					const div = document.createElement("div");
					div.dataset.file = file;
					div.dataset.destination = destination;
					div.dataset.status = "pending";
					div.innerHTML = `
						<div class="progressBar"></div>
						<div class="info">
							<div class="music">
								<b>${lastMusicIndex[file].title} - ${lastMusicIndex[file].artist}</b>
								<span><i></i> <span class="progressText">正在等待下载</span></span>
							</div>
							<div class="buttons">
								<i class="errorOnly" title="重试">&#xF33D;</i>
								<i class="successOnly" title="播放">&#xF509;</i>
								<i class="successOnly" title="在资源管理器中显示">&#xED6A;</i>
								<i class="successOnly" title="删除任务和文件">&#xEC2A;</i>
								<i title="删除任务">&#xF4C8;</i>
							</div>
						</div>`;
					div.querySelector(".buttons i:nth-child(1)").onclick = () => { // 重试
						div.dataset.status = "pending";
						div.querySelector(".progressText").textContent = "正在等待下载";
						div.style.setProperty("--progressWidth", "0%");
						DownloadController.loadDownloadStatus();
					}
					div.querySelector(".buttons i:nth-child(2)").onclick = () => { // 播放
						const smFile = "file:" + div.dataset.fileName;
						updateMusicIndex([smFile], () => {
							PlayerController.switchMusicWithList(smFile, [smFile]);
						});
					}
					div.querySelector(".buttons i:nth-child(3)").onclick = () => { // 资源管理器
						shell.showItemInFolder(div.dataset.fileName);
					}
					div.querySelector(".buttons i:nth-child(4)").onclick = () => { // 删除文件
						confirm("确实要删除此任务与本地已下载的文件吗？", () => {
							fs.unlinkSync(div.dataset.fileName);
							PlayerController.deleteFromList("file:" + div.dataset.fileName);
							div.remove();
						})
					}
					div.querySelector(".buttons i:nth-child(5)").onclick = () => { // 删除任务
						div.remove();
					}
					downloadContainer.appendChild(div);
				}
			});
			DownloadController.loadDownloadStatus();
		});
		document.querySelector('.left div[data-page-id="downloadPage"]').hidden = false;
		switchRightPage("downloadPage");
	},
	loadDownloadStatus() {
		const currentDownloadingCount = document.querySelectorAll("#downloadContainer>div[data-status='download']").length;
		if (currentDownloadingCount < config.getItem("parallelDownload") && document.querySelector("#downloadContainer>div[data-status='pending']")) {
			this.downloadFile();
			if (currentDownloadingCount + 1 < config.getItem("parallelDownload")) this.loadDownloadStatus();
		}
	},
	async downloadFile() {
		const element = document.querySelector("#downloadContainer>div[data-status='pending']");
		if (!element) return;
		const updateDownloadStatus = (status, text, progress = 0) => {
			element.dataset.status = status;
			element.querySelector(".progressText").textContent = text;
			element.style.setProperty("--progressWidth", progress + "%");
			DownloadController.loadDownloadStatus();
		}
		// 获取歌曲信息
		updateDownloadStatus("download", "正在获取下载地址");
		const file = element.dataset.file;
		const destination = element.dataset.destination;
		const fileScheme = file.split(":")[0];
		const downUrl = await ExtensionConfig[fileScheme].player.getPlayUrl(file, true);
		// 发起网络请求
		updateDownloadStatus("download", "正在连接下载地址");
		const xhr = new XMLHttpRequest();
		xhr.open("GET", downUrl, true);
		xhr.responseType = "arraybuffer";
		xhr.onprogress = event => {
			if (event.lengthComputable) {
				const percentComplete = Math.round((event.loaded / event.total) * 100);
				updateDownloadStatus("download", `正在下载 ${percentComplete}%`, percentComplete);
			} else {
				updateDownloadStatus("download", "正在下载曲目");
			}
		};
		xhr.onload = () => {
			updateDownloadStatus("download", "正在保存曲目", 100);
			const buffer = Buffer.from(xhr.response);
			const fileName = SimMusicTools.getWindowsLegalName(config.getItem("downloadFileName").replaceAll("[title]", lastMusicIndex[file].title).replaceAll("[artist]", lastMusicIndex[file].artist));
			const tempPath = path.join(destination, `${fileName}.simtemp`);
			const ws = fs.createWriteStream(tempPath);
			ws.on("finish", async () => {
				updateDownloadStatus("download", "正在写入元数据", 100);
				let coverArrBuffer;
				const coverData = lastMusicIndex[file].cover;
				if (typeof (coverData) == "object") coverArrBuffer = coverData;
				else {
					const coverRes = await fetch(coverData)
					coverArrBuffer = await coverRes.arrayBuffer();
				}
				const metadataResult = nodeId3.write({
					title: lastMusicIndex[file].title,
					artist: lastMusicIndex[file].artist,
					album: lastMusicIndex[file].album,
					unsynchronisedLyrics: {
						language: "XXX",
						text: lastMusicIndex[file].lyrics ? lastMusicIndex[file].lyrics : await ExtensionConfig[fileScheme].player.getLyrics(file)
					},
					image: {
						type: { id: 3, name: "front cover" },
						imageBuffer: Buffer.from(coverArrBuffer)
					}
				}, tempPath);
				if (metadataResult) {
					const renameResult = this.renameDownloadFile(destination, fileName)
					if (renameResult) {
						updateDownloadStatus("success", "曲目下载成功", 100);
						element.dataset.fileName = renameResult;
					}
					else updateDownloadStatus("error", "曲目写入失败", 0);
				} else {
					updateDownloadStatus("error", "曲目元数据写入失败", 0);
				}
			});
			ws.on("error", () => { updateDownloadStatus("error", "曲目保存失败", 0); });
			ws.write(buffer);
			ws.end();
		};
		xhr.onerror = () => {
			updateDownloadStatus("error", "曲目下载失败", 0);
		};
		xhr.send();
	},
	renameDownloadFile(dir, filename) {
		try {
			const originalFile = path.join(dir, `${filename}.simtemp`);
			const baseTargetFile = path.join(dir, `${filename}.mp3`);
			let targetFile = baseTargetFile;
			let count = 1;
			// 序号递增
			while (fs.existsSync(targetFile)) { targetFile = path.join(dir, `${filename} (${count++}).mp3`); }
			fs.renameSync(originalFile, targetFile);
			return targetFile;
		} catch (err) {
			return false;
		}
	}
}



// 迷你模式相关
let miniModeStatusTimeout;
function setMiniModeStatus(text) {
	if (!document.body.classList.contains("miniMode")) return;
	document.body.classList.add("miniModeStatus");
	document.getElementById("miniModeStatus").textContent = text;
	clearTimeout(miniModeStatusTimeout);
	miniModeStatusTimeout = setTimeout(() => { document.body.classList.remove("miniModeStatus"); }, 1000);
}



/*
// 系统集成
config.listenChange("systemMenu", value => {ipcRenderer.invoke("regFileExt", value);})
*/
ipcRenderer.on("fileLaunch", (_event, file) => {
	file = "file:" + file;
	console.log(file)

	updateMusicIndex([file], () => {
		const list = config.getItem("playList");
		if (list.includes(file)) PlayerController.switchMusic(file);
		else PlayerController.switchMusicWithList(file, [file].concat(list));
		SimAPUI.show();
	});
});

ipcRenderer.on("lrcWindowClosed", () => {
	WindowStatus.lyricsWin = false;
	document.getElementById("lyricsBtn").classList.remove("active");
});




// 设置页面
const SettingsPage = {
	data: [
		{ type: "title", text: "通用配置" },
		{ type: "boolean", text: "不驻留后台进程", description: "关闭主界面时停止播放并完全退出应用。", configItem: "disableBackground" },
		{ type: "title", text: "音频扫描" },
		{ type: "input", text: "音频格式", description: "扫描本地音乐时的音频文件扩展名，以空格分隔。", configItem: "musicFormats" },
		{ type: "button", text: "清除音频索引", description: "若您更改了音频元数据，可在此删除索引数据以重新从文件读取。", button: "清除", onclick: () => { SimMusicTools.writeMusicIndex({}, () => { alert("索引数据已清除，按「确定」重载此应用生效。", () => { ipcRenderer.invoke("restart"); }); }); } },
		{ type: "title", text: "播放界面" },
		{ type: "boolean", text: "背景动态混色", description: "关闭后可减少播放页对硬件资源的占用。", configItem: "backgroundBlur" },
		{ type: "boolean", text: "3D 特效", badges: ["experimental"], description: "在播放页的歌曲信息、播放列表与歌词视图使用 3D 视觉效果。", configItem: "3dEffect" },
		{ type: "boolean", text: "对播放按钮应用主题色", configItem: "playBtnColor" },
		{ type: "title", text: "播放控制" },
		{ type: "boolean", text: "快速重播", description: "在曲目即将结束时按「快退」按钮以回到当前曲目的开头。", configItem: "fastPlayback" },
		{ type: "boolean", text: "音频淡入淡出", description: "在按下「播放」或「暂停」时对音频的输出音量使用渐变效果。", configItem: "audioFade" },
		{ type: "button", text: "均衡器", badges: ["pending"], description: "下次一定。", button: "配置", onclick: () => { alert("还没写。下次一定。"); } },
		{ type: "title", text: "歌词视图" },
		{ type: "boolean", text: "层级虚化", description: "若无需虚化效果或需要提升性能可关闭此功能。", configItem: "lyricBlur" },
		{ type: "select", text: "文字对齐", options: [["left", "左端对齐"], ["center", "居中对齐"]], description: "此配置项切换曲目生效。", configItem: "lyricAlign" },
		{ type: "range", text: "歌词字号", configItem: "lyricSize", min: 1, max: 3 },
		{ type: "range", text: "歌词间距", configItem: "lyricSpace", min: .2, max: 1 },
		{ type: "boolean", text: "歌词多语言支持", description: "开启后，时间戳一致的不同歌词将作为多语言翻译同时渲染。此配置项切换曲目生效。", configItem: "lyricMultiLang" },
		{ type: "range", text: "歌词翻译字号", description: "同时控制歌词视图与桌面歌词中的翻译字号。", attachTo: "lyricMultiLang", configItem: "lyricTranslation", min: .5, max: 1 },
		{ type: "title", text: "桌面歌词" },
		{ type: "boolean", text: "启动时打开", configItem: "autoDesktopLyrics" },
		{ type: "boolean", text: "在播放页自动关闭", description: "当 SimMusic 主窗口打开播放页时自动关闭桌面歌词。", configItem: "desktopLyricsAutoHide" },
		{ type: "boolean", text: "显示歌词翻译", configItem: "desktopLyricsTranslation", attachTo: "lyricMultiLang" },
		{ type: "color", text: "字体颜色", configItem: "desktopLyricsColor" },
		{ type: "boolean", text: "启用边框", configItem: "desktopLyricsStrokeEnabled" },
		{ type: "color", text: "边框颜色", attachTo: "desktopLyricsStrokeEnabled", configItem: "desktopLyricsStroke" },
		{ type: "range", text: "字体大小", configItem: "desktopLyricsSize", min: 20, max: 60 },
		{ type: "range", text: "歌词区域宽度", configItem: "desktopLyricsWidth", min: 500, max: screen.width },
		{ type: "boolean", text: "始终居中", description: "无视用户左右拖拽操作，保持桌面歌词在屏幕中央。", configItem: "desktopLyricsCentered" },
		{ type: "title", text: "曲目下载" },
		{ type: "select", text: "并行下载数", options: [[1, "1 首曲目"], [2, "2 首曲目"], [3, "3 首曲目"], [4, "4 首曲目"], [5, "5 首曲目"]], description: "下载在线歌曲时并行下载的任务数量。", configItem: "parallelDownload" },
		{ type: "input", text: "命名格式", description: "可使用 [title] 表示歌曲名，[artist] 表示艺术家。SimMusic 会自动处理 Windows 无法写入的文件名。", configItem: "downloadFileName" },
	],
	init() {
		const settingsContainer = document.getElementById("settingsContainer");
		SettingsPage.loadElementHeight();
		if (settingsContainer.innerHTML) return;
		const badges = {
			"experimental": "<i>&#xED3F;</i> 实验性",
			"pending": "<i>&#xF4C8;</i> 暂未支持"
		};
		this.data.forEach(data => {
			const div = document.createElement("div");
			const normalContent = `
				<section>
					<div>
						${SimMusicTools.escapeHtml(data.text)}
						${data.badges ? data.badges.map(badge => `<badge>${badges[badge] ?? "<i>&#xF046;</i>未知"}</badge>`) : ""}
					</div>
					${data.description ? `<span>${SimMusicTools.escapeHtml(data.description)}</span>` : ""}
				</section>`;
			switch (data.type) {
				case "title":
					div.classList.add("title");
					div.textContent = data.text;
					break;
				case "boolean":
					div.classList.add("block");
					div.innerHTML = `${normalContent}<div class="toggle"></div>`;
					div.classList.add(config.getItem(data.configItem) ? "on" : "off");
					div.onclick = () => {
						const currentItem = config.getItem(data.configItem);
						config.setItem(data.configItem, !currentItem);
						div.classList[currentItem ? "remove" : "add"]("on");
						SettingsPage.loadElementFoldStatus();
					}
					break;
				case "range":
					div.classList.add("block");
					div.innerHTML = `${normalContent}<div class="range" min="${data.min}" max="${data.max}" value="${config.getItem(data.configItem)}"></div>`;
					const range = new SimProgress(div.querySelector(".range"));
					range.ondrag = value => { config.setItem(data.configItem, value); };
					break;
				case "input":
					div.classList.add("block");
					div.innerHTML = `${normalContent}<input type="${data.inputType ?? "text"}">`;
					const input = div.querySelector("input");
					input.value = config.getItem(data.configItem);
					input.autocomplete = input.spellcheck = false;
					input.onchange = () => { config.setItem(data.configItem, input.value); };
					break;
				case "select":
					div.classList.add("block");
					div.innerHTML = `${normalContent}<select></select>`;
					const select = div.querySelector("select");
					data.options.forEach(option => {
						const optionEle = document.createElement("option");
						optionEle.value = option[0];
						optionEle.textContent = option[1];
						select.appendChild(optionEle);
					});
					select.value = config.getItem(data.configItem);
					select.onchange = () => { config.setItem(data.configItem, select.value); };
					break;
				case "color":
					div.classList.add("block");
					div.innerHTML = `${normalContent}<div class="colorInput"><span></span><input type="color"></div>`;
					const colorInput = div.querySelector("input");
					colorInput.value = config.getItem(data.configItem);
					div.querySelector(".colorInput>span").textContent = config.getItem(data.configItem);
					div.querySelector(".colorInput>span").style.color = config.getItem(data.configItem);
					colorInput.onchange = () => {
						div.querySelector(".colorInput>span").textContent = colorInput.value;
						div.querySelector(".colorInput>span").style.color = colorInput.value;
						config.setItem(data.configItem, colorInput.value);
					};
					break;
				case "button":
					div.classList.add("block");
					div.innerHTML = `${normalContent}<button class="sub">${SimMusicTools.escapeHtml(data.button)}</button>`;
					div.onclick = data.onclick;
					break;
			}
			if (data.attachTo) div.dataset.attachTo = data.attachTo;
			settingsContainer.appendChild(div);
			SettingsPage.loadElementHeight();
			SettingsPage.loadElementFoldStatus();
		});
	},
	loadElementHeight() {
		document.querySelectorAll("#settingsContainer>div[data-attach-to]").forEach(div => {
			div.style.setProperty("--height", div.clientHeight + "px");
		});
	},
	loadElementFoldStatus() {
		document.querySelectorAll("#settingsContainer>div[data-attach-to]").forEach(div => {
			if (!config.getItem(div.dataset.attachTo)) div.classList.add("folded");
			else div.classList.remove("folded");
		});
	}
}
window.addEventListener("resize", SettingsPage.loadElementHeight);

// 桌面歌词
function updateDesktopLyricsConfig() {
	ipcRenderer.invoke("updateDesktopLyricsConfig", /* config.getItem("desktopLyricsProtection") */ null);
}
config.listenChange("desktopLyricsColor", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsStrokeEnabled", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsStroke", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsSize", updateDesktopLyricsConfig);
// config.listenChange("desktopLyricsProtection", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsWidth", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsTop", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsLeft", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsCentered", updateDesktopLyricsConfig);
config.listenChange("desktopLyricsTranslation", updateDesktopLyricsConfig);
updateDesktopLyricsConfig();
if (config.getItem("autoDesktopLyrics")) WindowOps.toggleLyrics();


// 关于页面
function initAboutPage() {
	document.querySelectorAll("#aboutPage a").forEach(a => {
		if (!a.onclick) a.onclick = () => {
			shell.openExternal(`https://github.com/` + a.innerHTML);
		}
	});
	document.querySelectorAll("#aboutPage section").forEach(link => {
		if (!link.onclick) link.onclick = () => {
			shell.openExternal(link.dataset.href);
		}
	});
	document.getElementById("copyrightYear").textContent = new Date().getFullYear();
}