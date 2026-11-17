// Tiny catalog and fictional participants, used ONLY in demo mode (no TMDB/Firebase configured).
const f = (id, title, year, directors, genres, countries, lang, keywords = []) => ({
  id: "demo-" + id, title, year, poster: null, directors, genres, countries, lang,
  keywords, cast: [], overview: "", runtime: null
});

export const DEMO_CATALOG = [
  f(1, "Pulp Fiction", 1994, ["Quentin Tarantino"], ["Crime", "Thriller"], ["US"], "en", ["nonlinear timeline", "hitman"]),
  f(2, "Kill Bill: Vol. 1", 2003, ["Quentin Tarantino"], ["Action", "Crime"], ["US"], "en", ["revenge", "martial arts"]),
  f(3, "Reservoir Dogs", 1992, ["Quentin Tarantino"], ["Crime", "Thriller"], ["US"], "en", ["heist", "nonlinear timeline"]),
  f(4, "Parasite", 2019, ["Bong Joon-ho"], ["Drama", "Thriller", "Comedy"], ["KR"], "ko", ["class differences", "family"]),
  f(5, "Memories of Murder", 2003, ["Bong Joon-ho"], ["Crime", "Thriller", "Drama"], ["KR"], "ko", ["serial killer", "detective"]),
  f(6, "Interstellar", 2014, ["Christopher Nolan"], ["Science Fiction", "Adventure", "Drama"], ["US", "GB"], "en", ["space travel", "family"]),
  f(7, "Inception", 2010, ["Christopher Nolan"], ["Science Fiction", "Action", "Thriller"], ["US", "GB"], "en", ["dream", "heist"]),
  f(8, "Oppenheimer", 2023, ["Christopher Nolan"], ["Drama", "History"], ["US", "GB"], "en", ["biography", "nonlinear timeline"]),
  f(9, "Blade Runner 2049", 2017, ["Denis Villeneuve"], ["Science Fiction", "Drama"], ["US"], "en", ["android", "dystopia"]),
  f(10, "Arrival", 2016, ["Denis Villeneuve"], ["Science Fiction", "Drama"], ["US"], "en", ["alien", "language"]),
  f(11, "City of God", 2002, ["Fernando Meirelles"], ["Crime", "Drama"], ["BR"], "pt", ["favela", "gang"]),
  f(12, "Central Station", 1998, ["Walter Salles"], ["Drama"], ["BR"], "pt", ["road movie", "family"]),
  f(13, "I'm Still Here", 2024, ["Walter Salles"], ["Drama", "History"], ["BR"], "pt", ["dictatorship", "family"]),
  f(14, "A Dog's Will", 2000, ["Guel Arraes"], ["Comedy", "Fantasy"], ["BR"], "pt", ["northeast brazil"]),
  f(15, "Spirited Away", 2001, ["Hayao Miyazaki"], ["Animation", "Fantasy", "Family"], ["JP"], "ja", ["spirit", "coming of age"]),
  f(16, "My Neighbor Totoro", 1988, ["Hayao Miyazaki"], ["Animation", "Fantasy", "Family"], ["JP"], "ja", ["spirit", "family"]),
  f(17, "The Godfather", 1972, ["Francis Ford Coppola"], ["Crime", "Drama"], ["US"], "en", ["mafia", "family"]),
  f(18, "Apocalypse Now", 1979, ["Francis Ford Coppola"], ["Drama", "War"], ["US"], "en", ["vietnam war"]),
  f(19, "Amélie", 2001, ["Jean-Pierre Jeunet"], ["Comedy", "Romance"], ["FR"], "fr", ["paris", "love"]),
  f(20, "Little Miss Sunshine", 2006, ["Jonathan Dayton", "Valerie Faris"], ["Comedy", "Drama"], ["US"], "en", ["road movie", "family"]),
  f(21, "The Grand Budapest Hotel", 2014, ["Wes Anderson"], ["Comedy", "Adventure"], ["US", "DE"], "en", ["hotel", "heist"]),
  f(22, "The Royal Tenenbaums", 2001, ["Wes Anderson"], ["Comedy", "Drama"], ["US"], "en", ["family"]),
  f(23, "The Matrix", 1999, ["Lana Wachowski", "Lilly Wachowski"], ["Science Fiction", "Action"], ["US"], "en", ["dystopia", "virtual reality"]),
  f(24, "The Shining", 1980, ["Stanley Kubrick"], ["Horror", "Thriller"], ["US", "GB"], "en", ["hotel", "family"]),
  f(25, "2001: A Space Odyssey", 1968, ["Stanley Kubrick"], ["Science Fiction", "Adventure"], ["US", "GB"], "en", ["space travel", "artificial intelligence"]),
  f(26, "Whiplash", 2014, ["Damien Chazelle"], ["Drama", "Music"], ["US"], "en", ["jazz", "obsession"]),
  f(27, "La La Land", 2016, ["Damien Chazelle"], ["Romance", "Music", "Comedy"], ["US"], "en", ["jazz", "love"]),
  f(28, "Lady Bird", 2017, ["Greta Gerwig"], ["Comedy", "Drama"], ["US"], "en", ["coming of age", "family"]),
  f(29, "Barbie", 2023, ["Greta Gerwig"], ["Comedy", "Adventure", "Fantasy"], ["US", "GB"], "en", ["doll", "feminism"]),
  f(30, "Get Out", 2017, ["Jordan Peele"], ["Horror", "Thriller"], ["US"], "en", ["racism", "family"])
];

const byId = Object.fromEntries(DEMO_CATALOG.map(x => [x.id, x]));
const mk = (id, name, ids) => ({ id: "demo-user-" + id, name, films: ids.map(i => byId["demo-" + i]), demo: true, updatedAt: 0 });

export const DEMO_PARTICIPANTS = [
  mk(1, "Ana (demo)", [4, 11, 15, 26]),
  mk(2, "Bruno (demo)", [6, 9, 10, 23]),
  mk(3, "Carla (demo)", [1, 3, 17, 5]),
  mk(4, "Diego (demo)", [21, 22, 20, 28]),
  mk(5, "Elisa (demo)", [12, 13, 11, 14]),
  mk(6, "Felipe (demo)", [7, 8, 6, 25])
];
