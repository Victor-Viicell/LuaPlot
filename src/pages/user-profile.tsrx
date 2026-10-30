import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function UserProfile() {
  return <PagePlaceholder path="/user/[user.username]" title="Profile" note="Creations, posts, follows and followers." />;
}

export default UserProfile;
