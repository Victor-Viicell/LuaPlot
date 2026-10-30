import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function UserEdit() {
  return <PagePlaceholder path="/user/[user.username]/edit" title="Account settings" note="Edit your own account, including NSFW preferences." />;
}

export default UserEdit;
