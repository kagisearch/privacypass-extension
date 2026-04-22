const target = new URL(location.hash.slice(1));
target.searchParams.delete("token");
location = target.toString();
