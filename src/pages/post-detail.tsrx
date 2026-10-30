import { PagePlaceholder } from "../components/PagePlaceholder.tsrx";

export function PostDetail() {
  return <PagePlaceholder path="/post/[post.id]" title="Post" note="Read a post and its comments." />;
}

export default PostDetail;
