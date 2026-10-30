import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function PersonaDetail() {
  return <PagePlaceholder path="/persona/[persona.id]" title="Persona" note="Read one of your personas." />;
}

export default PersonaDetail;
