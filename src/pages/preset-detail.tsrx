import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function PresetDetail() {
  return <PagePlaceholder path="/preset/[preset.id]" title="Preset" note="Read a preset's generation settings." />;
}

export default PresetDetail;
