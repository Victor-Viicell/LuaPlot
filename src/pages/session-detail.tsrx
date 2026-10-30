import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function SessionDetail() {
  return <PagePlaceholder path="/session/[session.id]" title="Session" note="Continue or review a chat session." />;
}

export default SessionDetail;
