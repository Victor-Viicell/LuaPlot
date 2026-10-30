import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function CharacterEdit() {
  return <PagePlaceholder path="/character/[character.id]/edit" title="Edit character" note="Edit a character you own." />;
}

export default CharacterEdit;
