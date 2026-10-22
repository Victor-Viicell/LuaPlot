import { LeftSidebar } from "./components/LeftSidebar.tsrx";
import { MainContainer } from "./components/MainContainer.tsrx";
import { RightSidebar } from "./components/RightSidebar.tsrx";
import { GameContext, createGameStore } from "./game/store";

export function App() @{
  const game = createGameStore();
  GameContext.set(game);

  <>
    <main class="app">
      <LeftSidebar />
      <MainContainer />
      <RightSidebar />
    </main>

    <style>
      .app {
        display: flex;
        flex-direction: row;
        gap: 0;
        height: 100dvh;
        margin: 0;
        padding: 0;
      }
    </style>
  </>
}
