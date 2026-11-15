/**
 * Up- and downvotes of ideas (#5): one vote per person, up or down. Pressing the arrow you already
 * chose takes the vote back; pressing the other one switches it. The score is upvotes minus
 * downvotes and may go below zero. Used by the server (what to change) and the client (the
 * optimistic score).
 */
export type IdeaVote = 'up' | 'down' | null

export interface VoteChange {
  /** The viewer's vote afterwards. */
  next: IdeaVote
  /** How the score moves (−2…+2). */
  delta: number
}

const value = (vote: IdeaVote) => (vote === 'up' ? 1 : vote === 'down' ? -1 : 0)

/** What pressing `pressed` does when the viewer's vote is `current`. */
export function applyVote(current: IdeaVote, pressed: 'up' | 'down'): VoteChange {
  const next: IdeaVote = current === pressed ? null : pressed
  return { next, delta: value(next) - value(current) }
}

/** The score shown: upvotes (Quackback's `vote_count`) minus downvotes. */
export function ideaScore(upvotes: number, downvotes: number): number {
  return upvotes - downvotes
}
