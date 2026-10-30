import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function CharacterDetail() {
  return <PagePlaceholder path="/character/[character.id]" title="Character" note="Read a character and start a session." />;
}

export default CharacterDetail;
