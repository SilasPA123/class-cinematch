// Popular picks shown as one-click chips. Each entry is [title, year].
// They are resolved through TMDB search at click time (title + year), so no hard-coded ids can go stale.
export const PRESETS = [
  { group: "All-time favorites", films: [
    ["The Godfather", 1972], ["Pulp Fiction", 1994], ["The Shawshank Redemption", 1994], ["Forrest Gump", 1994],
    ["Fight Club", 1999], ["The Dark Knight", 2008], ["Goodfellas", 1990], ["Schindler's List", 1993],
    ["Titanic", 1997], ["Back to the Future", 1985]
  ] },
  { group: "Sci-Fi & Fantasy", films: [
    ["Interstellar", 2014], ["Inception", 2010], ["The Matrix", 1999], ["Blade Runner 2049", 2017],
    ["Arrival", 2016], ["Dune", 2021], ["2001: A Space Odyssey", 1968], ["Everything Everywhere All at Once", 2022],
    ["Mad Max: Fury Road", 2015], ["The Lord of the Rings: The Fellowship of the Ring", 2001],
    ["Star Wars", 1977], ["Pan's Labyrinth", 2006]
  ] },
  { group: "Crime & Thriller", films: [
    ["Se7en", 1995], ["The Silence of the Lambs", 1991], ["Reservoir Dogs", 1992], ["Kill Bill: Vol. 1", 2003],
    ["Memories of Murder", 2003], ["Oldboy", 2003], ["City of God", 2002], ["No Country for Old Men", 2007]
  ] },
  { group: "Animation & Family", films: [
    ["Spirited Away", 2001], ["My Neighbor Totoro", 1988], ["Spider-Man: Into the Spider-Verse", 2018],
    ["Toy Story", 1995], ["Coco", 2017], ["Princess Mononoke", 1997], ["WALL·E", 2008], ["The Lion King", 1994]
  ] },
  { group: "Drama & Romance", films: [
    ["Parasite", 2019], ["Whiplash", 2014], ["La La Land", 2016], ["Lady Bird", 2017], ["Moonlight", 2016],
    ["Portrait of a Lady on Fire", 2019], ["Past Lives", 2023], ["Amélie", 2001],
    ["Eternal Sunshine of the Spotless Mind", 2004], ["Barbie", 2023], ["Oppenheimer", 2023]
  ] },
  { group: "Horror & Comedy", films: [
    ["Get Out", 2017], ["The Shining", 1980], ["Hereditary", 2018], ["Alien", 1979],
    ["The Grand Budapest Hotel", 2014], ["Superbad", 2007], ["Little Miss Sunshine", 2006],
    ["Monty Python and the Holy Grail", 1975], ["Shaun of the Dead", 2004]
  ] }
];
