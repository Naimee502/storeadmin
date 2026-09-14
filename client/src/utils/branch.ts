/**
 * Shown when the header is sitting on "All Branches" and the user tries to
 * save something that must belong to one real branch.
 *
 * Every one of these documents has `branchid` as a required ObjectId on the
 * server, so an empty string comes back as
 * `Cast to ObjectId failed for value ""` — a message no user can act on.
 * Said out loud as a toast on save, NOT by sealing the button: the user should
 * be able to fill the form out and be told what is missing, not find a dead
 * button with no explanation.
 */
export const BRANCH_REQUIRED =
  'Select a specific branch from the dropdown in the top-right (not "All Branches") before saving.';
