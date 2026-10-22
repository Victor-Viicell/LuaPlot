import "@fontsource-variable/jetbrains-mono";
import { mount } from "ripple";
import { App } from "./App.tsrx";

const target = document.getElementById("root");

if (!target) {
  throw new Error('Missing "#root" mount target in index.html');
}

mount(App, { target });
