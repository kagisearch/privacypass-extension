const target = new URL(location.hash.slice(1));
target.searchParams.delete("token");
// Use replace() instead of a plain assignment so this intermediate URL
// (whose hash still carries the token) is overwritten rather than kept
// as a separate browser history entry.
location.replace(target.toString());
