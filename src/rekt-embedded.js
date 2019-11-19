
      ["nav", "main",
      "npTime", "npArtist", "npTitle", "npDuration",
      "pageEQ", "navEQ",
      "pageMilkdrop", "navMilkdrop", "canvasMilkdrop",
      "pageStations", "navStations",
      "pageChat", "navChat",
      "pageArchive", "navArchive",
      "pageReleases", "navReleases",
      "pageSettings", "navSettings", "pageSettingsNav", "settingFlicker", "settingScanlines", "settingClearCache",
      ].forEach(val => {W[val] = I(val)});

      var requestPermission = () => {};
      var requested = false;
      var context;

      new Setting({
        name: "settingFlicker",
        body: settingFlicker,
        init: !IS_MOBILE,
        callback: (active) => {
          if (active) {
            D.body.classList.add("flicker")
          } else {
            D.body.classList.remove("flicker")
          }
        },
      });
      new Setting({
        name: "settingScanlines",
        body: settingScanlines,
        init: true,
        callback: (active) => {
          if (active) {
            D.body.classList.add("scanlines")
          } else {
            D.body.classList.remove("scanlines")
          }
        },
      });

      function initEQ() {
        return new Promise((resolve, reject) => {
          ["waves", "bars"].forEach(val => {W[val] = I(val)});
          // reject("test");
          audio.crossOrigin = "anonymous"
          context = new AudioContext();
          sourceNode = context.createMediaElementSource(audio);

          if (!AnalyserNode.prototype.getFloatTimeDomainData) {
            AnalyserNode.prototype.getFloatTimeDomainData = function(array) {
              this.timeUint8Array = new Uint8Array(this.fftSize);

              this.getFloatTimeDomainData = function(a) {
                this.getByteTimeDomainData(this.timeUint8Array);
                var i = 0;
                while (i < this.fftSize) {
                  array[i++] = (this.timeUint8Array[i] - 128 ) * 0.0078125;
                }
              };

              this.getFloatTimeDomainData(array);
              console.log("Initialised getFloatTimeDomainData");
            };
          }

          // 10 band Graphic EQ'
          let pBand = sourceNode;
          Array.from(D.getElementsByClassName('eq')).forEach(band => {
            let f = context.createBiquadFilter();
            let type = band.dataset.type || "peaking";
            f.type = type;
            f.frequency.value = band.dataset.f;
            if (band.dataset.q) {
              f.Q.value = band.dataset.q
            }
            pBand.connect(f);
            pBand = f;

            new Slider(`eq_band_${band.dataset.f}`, band, (v)=>{f.gain.value = (v-0.5)*24}, 0.5, 'vertical');
          });
          pBand.connect(context.destination);

          vis = new Visualiser(pBand, waves, bars);
          this.activeFuncs.push(vis.start);
          this.inactiveFuncs.push(vis.stop);

          resolve("test");
          // attach the audio element as a webaudio source last in case of an earlier error, because this will take over the source

        });
      }
      function initMilkdrop() {
        return new Promise((resolve, reject) => {
          Promise.all([
            scriptLoad("static/js/butterchurn/butterchurn.min.js"),
            scriptLoad("static/js/butterchurn/butterchurnExtraImages.min.js"),
            scriptLoad("static/js/butterchurn/presets/butterchurnPresets.min.js"),
            scriptLoad("static/js/butterchurn/presets/butterchurnPresetsExtra.min.js"),
            scriptLoad("static/js/butterchurn/presets/butterchurnPresetsExtra2.min.js"),
          ])
          .then(results => {
            console.log("Loaded Scripts", results);
            scriptLoad("static/js/butterchurn.js")
            .then(r => {
              console.log("MILKDROP", this);
              butterVis = new ButterchurnVis(this, context, vis.analyser);
              new Setting({
                name:"settingPresetCycle",
                heading: "Preset Autocycle",
                title: "Toggle Milkdrop Preset Autocycle",
                init: true,
                callback: (active) => {
                  butterVis.cycle = active;
                  butterVis.initialised && butterVis.clearCycle();
                },
              });
              // Push page activation functions
              this.activeFuncs.push(butterVis.start);
              this.inactiveFuncs.push(butterVis.stop);
              resolve(r);
            });
          })
          .catch(e => {
            console.log("Script Loading Error", e);
            reject(e);
          });
        });
      }

      function initStations() {
        return new Promise((resolve, reject) => {
          Array.from(D.getElementsByClassName('station')).forEach(s => new Station(s));
          !IS_BOT && startMeta();
          resolve("test");
        });
      }
      function onPopStations(params) {
        let s = Station.map.get(params.get('station'));
        if (s) {
          s.setActive(true)
        } else {
          Station.map.values().next().value.setActive();
        }
      }

      function initChat() {
        return new Promise((resolve, reject) => {
          ["chatSide", "chatMain", "chatInput", "serverList", "publicList", "privateList"].forEach(val => {W[val] = I(val)});
          rektirc = new IRC({
            side: chatSide,
            section: chatMain,
            input: chatInput,
            feedURL: "/irc",
            offerURL: "/offer",
            serverList: serverList,
            publicList: publicList,
            privateList: privateList,
          });
          Array.from(D.getElementsByClassName('channel')).forEach(c => {
            let chan = rektirc.createChan({name:c.dataset.channel, title:c});
            c.dataset.active && chan.setActive();
          });
          this.activeFuncs.push(()=>{
            Channel.active && Channel.active.scrollBottom();
            if (rektirc.connected) {
              Channel.active && Channel.active.input.input.focus();
            } else {
              rektirc.login.focus();
            }
          });
          resizeFuncs.push(chatResize);
          resolve("test");
        });
      }

      function initArchive() {
        return new Promise((resolve, reject) => {
          ["archiveMenu", "archiveMain"].forEach(val => {W[val] = I(val)});
          fetch('/api/archives')
          .then(r => r.json())
          .then(r => {
            console.log('Archives Result', r);
            r.forEach(obj => new DJ({name:obj.N,data:obj,parent:{section:archiveMain}}));
            resolve("test");
          })
          .catch(e => {
            reject(e);
          });

          this.activeFuncs.push(()=>{
            if (!DJ.active) {
              let dj = DJ.map.size && Array.from(DJ.map.values())[0];
              dj && dj.setActive();
            }
          });
        });
      }
      function onPopArchive(params) {
        if (params.get('dj') || params.get('file')) {
          let dj = DJ.map.get(params.get('dj'));
          let file = ArchiveTrack.map.get(params.get('file'));
          let t = params.get('t');

          if (!file && dj) {
            file = dj.children.values().next().value.children.values().next().value;
          }

          if (file) {
            file.setActive(true)
            if (t) {
              let position = parseFloat(t) / file.duration;
              if (position < 1) {
                file.setPosition(position);
              }
            }
          }
        }
      }

      function initReleases() {
        return new Promise((resolve, reject) => {
          ["releaseMenu", "releaseMain"].forEach(val => {W[val] = I(val)});
          fetch('/api/releases')
          .then(r => r.json())
          .then(r => {
            console.log('Releases Result', r);
            r.forEach(obj => new Artist({name:obj.N,data:obj,parent:{section:releaseMain}}));
            resolve("test");
          })
          .catch(e => {
            reject(e);
          });

          this.activeFuncs.push(()=>{
            if (!Artist.active) {
              let artist = Artist.map.size && Array.from(Artist.map.values())[0];
              artist && artist.setActive();
            }
          });
        });
      }
      function onPopReleases(params) {
        if (params.get('artist') || params.get('release') || params.get('track')) {
          let artist = Artist.map.get(params.get('artist'));
          console.log("ARTIST", artist);
          let release = (artist && artist.children.get(params.get('release'))) || Release.map.get(params.get('release')) || artist && artist.children.values().next().value;
          console.log("RELEASE", release);
          let file = release && release.children.get(params.get('track')) || ReleaseTrack.map.get(params.get('track')) || release && release.children.values().next().value;;
          file && file.setActive(true);
        }
      }

      function initSettings() {
        return new Promise((resolve, reject) => {
          resolve(true);
        });
      }


      function init() {
        return new Promise((resolve, reject) => {
          var promises = [];

          if (CAN_WEBAUDIO) {
            // Set up EQ page
            EQ = new Page({section:pageEQ, title:navEQ, init:initEQ});
            promises.push(EQ.promise);
            Milkdrop = undefined;

            if (CAN_WEBGL) {
              Milkdrop = new Page({section:pageMilkdrop, title:navMilkdrop, init:initMilkdrop});
              promises.push(Milkdrop.promise);
              Milkdrop.promise.then(() => {})
              .catch(e => {
                console.warn("Error initialising Milkdrop, disabling", e);
                Page.map.delete(Milkdrop.index);
                delete canvasMilkdrop;
                delete Milkdrop;
                removeEls([pageMilkdrop, navMilkdrop]);
              });
            } else {
              removeEls([pageMilkdrop, navMilkdrop]);
            }

            EQ.promise
            .then(()=>{
              Milkdrop && Milkdrop.init();
            })
            .catch(e => {
              console.warn("Error initialising WebAudio API, disabling EQ and Milkdrop", e);
              Page.map.delete(EQ.index);
              delete EQ;
              removeEls([pageEQ, navEQ, pageMilkdrop, navMilkdrop]);
            });

            EQ.init();
          } else {
            removeEls([pageEQ, navEQ, pageMilkdrop, navMilkdrop]);
          }

          // Build Station Page
          Stations = new Page({section:pageStations, title:navStations, init:initStations, pop:onPopStations});
          promises.push(Stations.promise);

          // Build Chat Page
          Chat = new Page({section:pageChat, title:navChat, init:initChat});
          promises.push(Chat.promise);
          Chat.promise
          .then(()=>{
            !IS_BOT && rektirc.startFeed();
          })
          .catch(e=>{
            console.warn("Error initialising Chat", e);
            Page.map.delete(Chat.index);
            delete Chat;
            removeEls([pageChat, navChat]);
          });
          Chat.init();

          // Build Archives Page
          Archives = new Page({section:pageArchive, title:navArchive, init:initArchive, pop: onPopArchive});
          promises.push(Archives.promise);
          Archives.promise
          .then(()=>{
            // Activate latest archive
          })
          .catch(e=>{
            console.warn("Error initialising Archives", e);
            Page.map.delete(Archives.index);
            delete Archives;
            removeEls([pageArchive, navArchive]);
          });
          // Build Releases Page
          Releases = new Page({section:pageReleases, title:navReleases, init:initReleases, pop:onPopReleases});
          promises.push(Releases.promise);
          Releases.promise
          .then(()=>{
            // Activate latest release
          })
          .catch(e=>{
            console.warn("Error initialising Releases", e);
            Page.map.delete(Releases.index);
            delete Releases;
            removeEls([pageReleases, navReleases]);
          });

          Settings = new Page({section:pageSettings, title:navSettings, init:initSettings, toggle:true});
          promises.push(Settings.promise);
          Settings.init();

          Stations.promise
          .then(()=>{
            ArchiveTrack.station = Station.map.get("archives");
            ReleaseTrack.station = Station.map.get("releases");
            Archives.init();
            Releases.init();
          })
          .catch(e=>{});

          Stations.init();

          Promise.all(promises)
          .then(()=>{
            resolve("All Promises Complete");
          })
          .catch(e => {
            resolve("Something Went Wrong", e);
            reject(e);
          });
        });
      }
      init()
      .then(e=>{
        console.log(e);
      })
      .catch(e=>console.log(e));

      // Player
      ["audio", "player", "playerPlay", "playerStop", "activeMask", "passiveMask", "volumeSVG", "playerSlider", "playerSliderActive", "nowplayingDiv", "seek"].forEach(val => {W[val] = I(val)});
      const SVG_WIDTH = volumeSVG.width.baseVal.value;

      // Slider Setup
      volumeSlider = new Slider('volume', player, (v)=>{
        audio.volume = v;
        youtube && youtube.setVolume && youtube.setVolume(v * 100);
      }, 1, 'horizontal', true);
      volumeSlider.setValueSilent = function(value) {
        this.value = clamp(1, value);
        var x = this.value * SVG_WIDTH;
        activeMask.setAttribute("width", x), passiveMask.setAttribute("x", x);
        playerSliderActive.style.width = this.value*100 + '%';
        sl(this.id, this.value);
      }
      volumeSlider.slider = volumeSVG;
      volumeSlider.init();

      // Playback Slider
      seeker = new Slider('seek', seek, (v)=>{
        Station.active && Station.active.file && Station.active.file.slider.setValue(v);
      }, 0, 'horizontal', false);


      // Player Functions
      var stopTimeout;
      function play(){
        clearTimeout(stopTimeout);
        let station = Station.active;
        if (!station) {
          station = Station.map.get("rekt");
          station && station.setActive();
        }
        station && station.updateMediaSession();
        let newSrc = station && station.src || "/stream/rekt.m4a";
        if (!audio.src.endsWith(newSrc)) {
          audio.src = newSrc;
          audio.load();
          console.log("Audio Loaded");
        }
        context && context.resume();
        audio.play().catch(e => console.warn(e));
        D.body.classList.add("playing");
        playing = true;
        youtube && youtube.stopVideo && youtube.stopVideo();
        requestPermission();
      }
      function pause(){
        audio.pause();
        D.body.classList.remove("playing");
        playing = false;
      }
      function stop(force){
        audio.pause();
        D.body.classList.remove("playing");
        playing = false;
        if (force) {
          audio.src = '';
          console.log("Audio Stopped");
        } else {
          stopTimeout = setTimeout(()=>{
            audio.src = '';
            console.log("Audio Stopped");
          }, 10000)
        }
      }
      function replay(e) {
        if (playing) {
          console.log("Restarting Stream");
          stop(true);
          play();
        }
      }

      audio.addEventListener('error', replay);
      audio.addEventListener('stalled', replay);
      audio.addEventListener('ended', (e) => Station.active.file && Station.active.file.ended(e));
      audio.addEventListener('pause', (e) => Station.active.file && Station.active.file.pause(e));
      audio.addEventListener('durationchange', (e) => Station.active.file && Station.active.file.durationchange(e));
      audio.addEventListener('timeupdate', (e) => Station.active.file && Station.active.file.timeupdate(e));

      playerPlay.addEventListener('click', play, false);
      playerStop.addEventListener('click', stop, false);

      if ('mediaSession' in N) {
        Station.mediaSession = true;
        N.mediaSession.setActionHandler('play', play);
        N.mediaSession.setActionHandler('pause', stop);

        N.mediaSession.setActionHandler('seekbackward', () => {

        });
        N.mediaSession.setActionHandler('seekforward', () => {

        });
        N.mediaSession.setActionHandler('previoustrack', () => {

        });
        N.mediaSession.setActionHandler('nexttrack', () => {

        });
      }

      new Setting({
        name: "settingClearCache",
        body: settingClearCache,
        toggle: false,
        callback: () => {
          W.localStorage && localStorage.clear();
          let promises = []
          W.caches && promises.push(caches.keys().then(cs=>cs.forEach(c=>caches.delete(c))));

          N.serviceWorker && promises.push(N.serviceWorker.getRegistrations().then(rs=>{
            rs.forEach(r=>r.unregister());
          }));
          console.log("Cache Clear!");
          Promise.all(promises).finally(res => {
            location.reload();
          });
        },
      });

      function getState(e, init) {
        let params = new URLSearchParams(location.search);
        let redir = params.get('redir');
        let page = Page.map.get(redir);
        if (page) {
          W.history && W.history.replaceState({}, D.title, `#${redir}`)
        } else {
          let hash = location.hash.slice(1);
          page = Page.map.get(hash) || Page.map.get("EQ");
        }
        page && page.setActive();
        popStateFuncs.forEach(f => f(params));
      }
      W.onpopstate = getState;
      getState(null, true);



      // Script has loaded
      D.body.classList.replace("loading", "loaded");