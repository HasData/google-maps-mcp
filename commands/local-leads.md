---
description: A contact list of local businesses for a category and a city, from Google Maps
---

Build a lead list of local businesses.

Ask me for the category and the city if I have not given them, and for how many rows I want. Twenty is a sensible default.

Then:

1. Call `hasdata_google_maps_search_performMapSearch` with `q` written the way a person types it into Maps, such as `dentists in Portland, Oregon`. Page with `start` until you have the count I asked for.
2. For each result keep name, address, phone, website, rating, review count and `placeId`.
3. Drop entries with no phone and no website, and say how many you dropped. A lead with neither is not a lead.
4. Sort by review count so the established ones come first, unless I asked for something else.
5. Hand back a table, and note which places have no website at all. That gap is usually the reason someone asked.

Stay inside what the search returns. Do not open place details for every row unless I ask, because that is one call per business and the cost adds up.
