# Authors are copied onto messages

Every message shows its author's identity and owner (story 26 of mattpocock/cookout#1), and identities can be deleted. So, as the chief of staff decided on 2026-11-22 while building mattpocock/cookout#5 (Matt was told and can override it), a message stores a copy of its author (`{ name, owner? }`) taken when it is posted, rather than a reference to a live identity. History then survives the author's deletion and reads without a join, at the accepted cost that an old message keeps an owner that has since changed.
