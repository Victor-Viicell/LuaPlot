import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function PresetEdit() {
  return <PagePlaceholder path="/preset/[preset.id]/edit" title="Edit preset" note="Edit a preset you own." />;
}

export default PresetEdit;
