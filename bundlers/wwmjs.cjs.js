var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var src_exports = {};
__export(src_exports, {
  WWM: () => WWM
});
module.exports = __toCommonJS(src_exports);
var WWM = class {
  constructor(options) {
    this.workers = [];
    this.max = 4;
    this.count = 0;
    this.options = options || { type: "classic" };
  }
  create(fn, scripts) {
    const worker = this.createWorker(fn, scripts);
    this.workers.push(worker);
    return worker;
  }
  terminateAll() {
    this.workers.forEach((worker) => worker.terminate());
    this.workers.length = 0;
  }
  list() {
    return this.workers;
  }
  async runAll(data) {
    const results = [];
    let index = 0;
    while (index < this.workers.length) {
      const nextBatch = Math.min(this.workers.length - index, this.max - this.count);
      const promises = this.workers.slice(index, index + nextBatch).map((worker) => worker.run(data).finally(() => {
        this.count--;
      }));
      this.count += nextBatch;
      index += nextBatch;
      const result = await Promise.all(promises);
      results.push(...result);
    }
    return results;
  }
  createWorker(fn, scripts = []) {
    const state = {
      status: "init",
      progress: 0,
      result: null,
      error: null
    };
    const scriptURLs = scripts.map((script) => URL.createObjectURL(new Blob([`self.${script.name}=${script.value.toString()};`])));
    const blob = new Blob([...scriptURLs, `self.onmessage=${fn.toString()};`], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url, this.options);
    let paused = false;
    const pauseQueue = [];
    const onmessage = worker.onmessage || (() => {
    });
    worker.onmessage = (event) => paused ? pauseQueue.push(event) : onmessage(event);
    const api = {
      _shell: worker,
      run: (data) => this.run(worker, data),
      terminate: () => this.terminate(api),
      subscribe: (fn2) => worker.addEventListener("message", fn2),
      unsubscribe: (fn2) => worker.removeEventListener("message", fn2),
      importScripts: (...scripts2) => {
        const scriptURLs2 = scripts2.map((script) => URL.createObjectURL(new Blob([script])));
        worker.postMessage({ type: "importScripts", data: scriptURLs2 });
      },
      getState: () => Object.assign({}, state),
      pause: () => paused = true,
      play: () => {
        paused = false;
        if (pauseQueue.length > 0)
          onmessage(pauseQueue.shift());
      }
    };
    return api;
  }
  postMessageAll(message, transfer) {
    this.workers.forEach((worker) => {
      worker._shell.postMessage(message, transfer);
    });
  }
  run(worker, data) {
    return new Promise((resolve, reject) => {
      const state = worker.getState();
      state.status = "running";
      worker.setState(state);
      worker.onerror = (event) => {
        const state2 = worker.getState();
        state2.error = event.message;
        state2.status = "error";
        worker.setState(state2);
        reject(event);
      };
      worker.onmessage = (event) => {
        const state2 = worker.getState();
        state2.result = event.data;
        state2.status = "finished";
        worker.setState(state2);
        resolve(event);
      };
      worker.postMessage(data || (data = {}));
    });
  }
  terminate(api) {
    const index = this.workers.indexOf(api);
    if (index !== -1)
      this.workers.splice(index, 1);
    api._shell.terminate();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WWM
});
