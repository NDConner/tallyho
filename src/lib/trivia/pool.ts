// Curated medium-hard trivia pool. Each question maps to one catalog topic.
export interface StarterQuestion {
  category: string;
  topic: string;
  prompt: string;
  answer: string;
  variants: string[];
  hard?: boolean; // taken before non-hard questions of the same topic
  expert?: boolean; // taken before merely-hard questions (toughest tier)
}

export const STARTER_POOL: StarterQuestion[] = [
  // ===================== SPORTS =====================

  // Baseball
  { category: "Sports", topic: "Baseball", prompt: "Who holds the MLB record for career hits, with 4,256?", answer: "Pete Rose", variants: ["Rose"] },
  { category: "Sports", topic: "Baseball", prompt: "How many consecutive games did Cal Ripken Jr. play to set the MLB record?", answer: "2,632", variants: ["2632"] },
  { category: "Sports", topic: "Baseball", prompt: "Which pitcher holds the MLB record with 5,714 career strikeouts?", answer: "Nolan Ryan", variants: ["Ryan"] },
  { category: "Sports", topic: "Baseball", prompt: "With which team did Jackie Robinson break baseball's color barrier in 1947?", answer: "Brooklyn Dodgers", variants: ["Dodgers", "Brooklyn"] },

  // Basketball
  { category: "Sports", topic: "Basketball", prompt: "Who scored 100 points in a single NBA game in 1962?", answer: "Wilt Chamberlain", variants: ["Chamberlain", "Wilt"] },
  { category: "Sports", topic: "Basketball", prompt: "Which player won a record six NBA MVP awards?", answer: "Kareem Abdul-Jabbar", variants: ["Kareem", "Abdul-Jabbar"] },
  { category: "Sports", topic: "Basketball", prompt: "Which team holds the NBA record for most regular-season wins, with 73?", answer: "Golden State Warriors", variants: ["Warriors", "Golden State"] },
  { category: "Sports", topic: "Basketball", prompt: "Who became the NBA's all-time leading scorer in 2023?", answer: "LeBron James", variants: ["LeBron", "James"] },

  // NFL Football
  { category: "Sports", topic: "NFL Football", prompt: "Which quarterback has won a record seven Super Bowls?", answer: "Tom Brady", variants: ["Brady"] },
  { category: "Sports", topic: "NFL Football", prompt: "Which team completed the NFL's only perfect season in 1972?", answer: "Miami Dolphins", variants: ["Dolphins", "Miami"] },
  { category: "Sports", topic: "NFL Football", prompt: "Who set the NFL single-season rushing record with 2,105 yards in 1984?", answer: "Eric Dickerson", variants: ["Dickerson"] },
  { category: "Sports", topic: "NFL Football", prompt: "Who is the NFL's all-time leading rusher?", answer: "Emmitt Smith", variants: ["Smith", "Emmitt"] },

  // Soccer
  { category: "Sports", topic: "Soccer", prompt: "Which nation has won the most men's FIFA World Cups, with five?", answer: "Brazil", variants: ["Brazil"] },
  { category: "Sports", topic: "Soccer", prompt: "Who won the first men's Ballon d'Or, in 1956?", answer: "Stanley Matthews", variants: ["Matthews"] },
  { category: "Sports", topic: "Soccer", prompt: "Which club has won the most European Cup / Champions League titles?", answer: "Real Madrid", variants: ["Madrid"] },
  { category: "Sports", topic: "Soccer", prompt: "Which country hosted and won the first FIFA World Cup, in 1930?", answer: "Uruguay", variants: ["Uruguay"] },

  // Tennis
  { category: "Sports", topic: "Tennis", prompt: "Who holds the record for most men's Grand Slam singles titles, with 24?", answer: "Novak Djokovic", variants: ["Djokovic"] },
  { category: "Sports", topic: "Tennis", prompt: "Which woman won 23 Grand Slam singles titles in the Open Era?", answer: "Serena Williams", variants: ["Serena", "Williams"] },
  { category: "Sports", topic: "Tennis", prompt: "On what surface is the French Open played?", answer: "Clay", variants: ["clay court", "red clay"] },
  { category: "Sports", topic: "Tennis", prompt: "Which Grand Slam, first held in 1877, is the oldest tennis tournament?", answer: "Wimbledon", variants: ["The Championships"] },

  // Golf
  { category: "Sports", topic: "Golf", prompt: "Who has won the most men's major championships, with 18?", answer: "Jack Nicklaus", variants: ["Nicklaus"] },
  { category: "Sports", topic: "Golf", prompt: "Which major tournament awards its winner a green jacket?", answer: "The Masters", variants: ["Masters"] },
  { category: "Sports", topic: "Golf", prompt: "At which Georgia course is The Masters played every year?", answer: "Augusta National", variants: ["Augusta"] },
  { category: "Sports", topic: "Golf", prompt: "What term describes a score of three strokes under par on one hole?", answer: "Albatross", variants: ["double eagle"] },

  // Hockey
  { category: "Sports", topic: "Hockey", prompt: "Who is the NHL's all-time leading scorer, with 2,857 points?", answer: "Wayne Gretzky", variants: ["Gretzky"] },
  { category: "Sports", topic: "Hockey", prompt: "Which trophy is awarded to the NHL playoff champion?", answer: "Stanley Cup", variants: ["the Stanley Cup"] },
  { category: "Sports", topic: "Hockey", prompt: "Which franchise has won the most Stanley Cups?", answer: "Montreal Canadiens", variants: ["Canadiens", "Montreal"] },
  { category: "Sports", topic: "Hockey", prompt: "How many players per team are on the ice during normal play, including the goalie?", answer: "6", variants: ["six"] },

  // Olympics
  { category: "Sports", topic: "Olympics", prompt: "Which swimmer has won the most Olympic gold medals, with 23?", answer: "Michael Phelps", variants: ["Phelps"] },
  { category: "Sports", topic: "Olympics", prompt: "In which city were the first modern Olympic Games held, in 1896?", answer: "Athens", variants: ["Athens, Greece"] },
  { category: "Sports", topic: "Olympics", prompt: "How many interlocking rings appear on the Olympic flag?", answer: "5", variants: ["five"] },
  { category: "Sports", topic: "Olympics", prompt: "Which city became the first to host the Summer Olympics three times, in 2012?", answer: "London", variants: ["London, England"] },

  // Boxing
  { category: "Sports", topic: "Boxing", prompt: "Who handed Muhammad Ali his first pro loss in the 1971 'Fight of the Century'?", answer: "Joe Frazier", variants: ["Frazier"] },
  { category: "Sports", topic: "Boxing", prompt: "Which heavyweight was nicknamed 'Iron Mike'?", answer: "Mike Tyson", variants: ["Tyson"] },
  { category: "Sports", topic: "Boxing", prompt: "Which boxer was stripped of his title for refusing the military draft in 1967?", answer: "Muhammad Ali", variants: ["Ali", "Cassius Clay"] },
  { category: "Sports", topic: "Boxing", prompt: "In how many weight divisions did Manny Pacquiao win world titles, a record?", answer: "8", variants: ["eight"] },

  // Formula 1
  { category: "Sports", topic: "Formula 1", prompt: "Which German driver won seven F1 titles, including five straight with Ferrari?", answer: "Michael Schumacher", variants: ["Schumacher"] },
  { category: "Sports", topic: "Formula 1", prompt: "Which constructor has won the most F1 Constructors' Championships?", answer: "Ferrari", variants: ["Scuderia Ferrari"] },
  { category: "Sports", topic: "Formula 1", prompt: "Which driver won four straight F1 titles from 2010 to 2013 with Red Bull?", answer: "Sebastian Vettel", variants: ["Vettel"] },
  { category: "Sports", topic: "Formula 1", prompt: "The Monaco Grand Prix winds through the streets of which district?", answer: "Monte Carlo", variants: ["Monte-Carlo"] },

  // Cycling
  { category: "Sports", topic: "Cycling", prompt: "Which American was stripped of seven Tour de France titles for doping?", answer: "Lance Armstrong", variants: ["Armstrong"] },
  { category: "Sports", topic: "Cycling", prompt: "What color jersey is worn by the overall leader of the Tour de France?", answer: "Yellow", variants: ["maillot jaune", "yellow jersey"] },
  { category: "Sports", topic: "Cycling", prompt: "The Giro d'Italia is the national grand tour of which country?", answer: "Italy", variants: ["Italy"] },
  { category: "Sports", topic: "Cycling", prompt: "What is the term for the main group of riders bunched together in a race?", answer: "Peloton", variants: ["the peloton"] },

  // Swimming
  { category: "Sports", topic: "Swimming", prompt: "Which stroke is generally the fastest in competitive swimming?", answer: "Freestyle", variants: ["front crawl", "crawl"] },
  { category: "Sports", topic: "Swimming", prompt: "Who won a record eight gold medals at a single Olympics, in 2008?", answer: "Michael Phelps", variants: ["Phelps"] },
  { category: "Sports", topic: "Swimming", prompt: "How many gold medals did Mark Spitz win at the 1972 Munich Olympics?", answer: "7", variants: ["seven"] },
  { category: "Sports", topic: "Swimming", prompt: "What is the length, in meters, of an Olympic 'long course' pool?", answer: "50", variants: ["50 meters", "fifty"] },

  // Track & Field
  { category: "Sports", topic: "Track & Field", prompt: "Who holds the men's 100m world record at 9.58 seconds?", answer: "Usain Bolt", variants: ["Bolt"] },
  { category: "Sports", topic: "Track & Field", prompt: "How many separate events make up the men's decathlon?", answer: "10", variants: ["ten"] },
  { category: "Sports", topic: "Track & Field", prompt: "Which nation, home to Eliud Kipchoge, dominates men's distance running?", answer: "Kenya", variants: ["Kenya"] },
  { category: "Sports", topic: "Track & Field", prompt: "Which track race famously requires runners to clear a water jump?", answer: "Steeplechase", variants: ["3000m steeplechase"] },

  // College Sports
  { category: "Sports", topic: "College Sports", prompt: "Which trophy honors the most outstanding player in college football each year?", answer: "Heisman Trophy", variants: ["Heisman"] },
  { category: "Sports", topic: "College Sports", prompt: "What nickname is given to the NCAA Division I men's basketball tournament?", answer: "March Madness", variants: ["the Big Dance"] },
  { category: "Sports", topic: "College Sports", prompt: "Which university has won the most NCAA men's basketball titles, with 11?", answer: "UCLA", variants: ["UCLA"] },
  { category: "Sports", topic: "College Sports", prompt: "Which college football rivalry between Michigan and Ohio State is simply called 'The Game'?", answer: "Michigan-Ohio State", variants: ["Ohio State-Michigan", "Michigan vs Ohio State"] },

  // Extreme Sports
  { category: "Sports", topic: "Extreme Sports", prompt: "What is the name of the fundamental skateboard jump invented by Alan Gelfand?", answer: "Ollie", variants: ["the ollie"] },
  { category: "Sports", topic: "Extreme Sports", prompt: "Which annual extreme sports competition is produced by ESPN?", answer: "X Games", variants: ["the X Games"] },
  { category: "Sports", topic: "Extreme Sports", prompt: "What acronym names the sport of parachuting from buildings, antennas, spans, and earth?", answer: "BASE jumping", variants: ["BASE jump"] },
  { category: "Sports", topic: "Extreme Sports", prompt: "Which skateboarder first landed a 900 in competition, in 1999?", answer: "Tony Hawk", variants: ["Hawk"] },

  // ===================== GEOGRAPHY =====================

  // World Capitals
  { category: "Geography", topic: "World Capitals", prompt: "What is the capital of Australia?", answer: "Canberra", variants: ["Canberra"] },
  { category: "Geography", topic: "World Capitals", prompt: "What is the capital of Canada?", answer: "Ottawa", variants: ["Ottawa"] },
  { category: "Geography", topic: "World Capitals", prompt: "What is the capital of Turkey?", answer: "Ankara", variants: ["Ankara"] },
  { category: "Geography", topic: "World Capitals", prompt: "What is the capital of Brazil?", answer: "Brasilia", variants: ["Brasília"] },

  // US States
  { category: "Geography", topic: "US States", prompt: "Which US state is the largest by land area?", answer: "Alaska", variants: ["Alaska"] },
  { category: "Geography", topic: "US States", prompt: "Which is the only US state that borders just one other state?", answer: "Maine", variants: ["Maine"] },
  { category: "Geography", topic: "US States", prompt: "What is the capital of New York State?", answer: "Albany", variants: ["Albany"] },
  { category: "Geography", topic: "US States", prompt: "Which state was the last of the contiguous 48 to join the Union, in 1912?", answer: "Arizona", variants: ["Arizona"] },

  // Rivers & Lakes
  { category: "Geography", topic: "Rivers & Lakes", prompt: "Which river is traditionally considered the longest in the world?", answer: "Nile", variants: ["the Nile", "Nile River"] },
  { category: "Geography", topic: "Rivers & Lakes", prompt: "What is the largest freshwater lake in the world by surface area?", answer: "Lake Superior", variants: ["Superior"] },
  { category: "Geography", topic: "Rivers & Lakes", prompt: "Which river flows through the heart of Paris?", answer: "Seine", variants: ["the Seine"] },
  { category: "Geography", topic: "Rivers & Lakes", prompt: "What is the world's largest lake by area, a saltwater lake bordered by five nations?", answer: "Caspian Sea", variants: ["the Caspian Sea", "Caspian"] },

  // Mountains
  { category: "Geography", topic: "Mountains", prompt: "What is the tallest mountain on Earth measured above sea level?", answer: "Mount Everest", variants: ["Everest"] },
  { category: "Geography", topic: "Mountains", prompt: "Which mountain range traditionally separates Europe from Asia?", answer: "Ural Mountains", variants: ["Urals", "the Urals"] },
  { category: "Geography", topic: "Mountains", prompt: "What is the highest mountain in Africa?", answer: "Mount Kilimanjaro", variants: ["Kilimanjaro"] },
  { category: "Geography", topic: "Mountains", prompt: "Which peak is the highest in the Alps?", answer: "Mont Blanc", variants: ["Mont Blanc"] },

  // Oceans & Seas
  { category: "Geography", topic: "Oceans & Seas", prompt: "What is the largest and deepest ocean on Earth?", answer: "Pacific Ocean", variants: ["Pacific", "the Pacific"] },
  { category: "Geography", topic: "Oceans & Seas", prompt: "Which salt lake between Israel and Jordan is famous for letting swimmers float?", answer: "Dead Sea", variants: ["the Dead Sea"] },
  { category: "Geography", topic: "Oceans & Seas", prompt: "Which sea separates Europe from Africa, joining the Atlantic at Gibraltar?", answer: "Mediterranean Sea", variants: ["the Mediterranean", "Mediterranean"] },
  { category: "Geography", topic: "Oceans & Seas", prompt: "Which is the smallest and shallowest of the world's five oceans?", answer: "Arctic Ocean", variants: ["Arctic", "the Arctic"] },

  // Deserts
  { category: "Geography", topic: "Deserts", prompt: "What is the largest hot desert in the world?", answer: "Sahara", variants: ["Sahara Desert", "the Sahara"] },
  { category: "Geography", topic: "Deserts", prompt: "Which continent is technically the largest desert on Earth?", answer: "Antarctica", variants: ["Antarctic", "Antarctic Desert"] },
  { category: "Geography", topic: "Deserts", prompt: "Which South American desert is the driest nonpolar place on Earth?", answer: "Atacama Desert", variants: ["Atacama"] },
  { category: "Geography", topic: "Deserts", prompt: "The Gobi Desert spans parts of China and which other country?", answer: "Mongolia", variants: ["Mongolia"] },

  // European Geography
  { category: "Geography", topic: "European Geography", prompt: "Which Scandinavian country is famous for deep coastal fjords and the city of Bergen?", answer: "Norway", variants: ["Norway"] },
  { category: "Geography", topic: "European Geography", prompt: "What is the smallest country in the world, enclosed within Rome?", answer: "Vatican City", variants: ["the Vatican", "Vatican"] },
  { category: "Geography", topic: "European Geography", prompt: "Which river is the longest in Europe, emptying into the Caspian Sea?", answer: "Volga", variants: ["the Volga"] },
  { category: "Geography", topic: "European Geography", prompt: "The Iberian Peninsula is shared by Spain and which other country?", answer: "Portugal", variants: ["Portugal"] },

  // Asian Geography
  { category: "Geography", topic: "Asian Geography", prompt: "Which country became the world's most populous in 2023?", answer: "India", variants: ["India"] },
  { category: "Geography", topic: "Asian Geography", prompt: "Which Southeast Asian nation is made up of more than 17,000 islands?", answer: "Indonesia", variants: ["Indonesia"] },
  { category: "Geography", topic: "Asian Geography", prompt: "Which narrow strait is the key shipping lane between the Malay Peninsula and Sumatra?", answer: "Strait of Malacca", variants: ["Malacca Strait", "Malacca"] },
  { category: "Geography", topic: "Asian Geography", prompt: "Which Himalayan country has the world's only non-rectangular national flag?", answer: "Nepal", variants: ["Nepal"] },

  // African Geography
  { category: "Geography", topic: "African Geography", prompt: "What is the most populous country in Africa?", answer: "Nigeria", variants: ["Nigeria"] },
  { category: "Geography", topic: "African Geography", prompt: "Which country completely surrounds the kingdom of Lesotho?", answer: "South Africa", variants: ["South Africa"] },
  { category: "Geography", topic: "African Geography", prompt: "What is the largest country in Africa by land area?", answer: "Algeria", variants: ["Algeria"] },
  { category: "Geography", topic: "African Geography", prompt: "Which lake, Africa's largest, is the chief source of the White Nile?", answer: "Lake Victoria", variants: ["Victoria"] },

  // Flags
  { category: "Geography", topic: "Flags", prompt: "Which country's flag features a single red maple leaf?", answer: "Canada", variants: ["Canada"] },
  { category: "Geography", topic: "Flags", prompt: "Which Middle Eastern country's flag features a green cedar tree?", answer: "Lebanon", variants: ["Lebanon"] },
  { category: "Geography", topic: "Flags", prompt: "Which country's flag has a yellow cross on a blue field?", answer: "Sweden", variants: ["Sweden"] },
  { category: "Geography", topic: "Flags", prompt: "Which country's national flag depicts the temple of Angkor Wat?", answer: "Cambodia", variants: ["Cambodia"] },

  // Landmarks
  { category: "Geography", topic: "Landmarks", prompt: "In which city is the ancient Colosseum located?", answer: "Rome", variants: ["Rome, Italy"] },
  { category: "Geography", topic: "Landmarks", prompt: "The rock-cut city of Petra is found in which country?", answer: "Jordan", variants: ["Jordan"] },
  { category: "Geography", topic: "Landmarks", prompt: "The Inca citadel of Machu Picchu lies in which country?", answer: "Peru", variants: ["Peru"] },
  { category: "Geography", topic: "Landmarks", prompt: "The Christ the Redeemer statue overlooks which Brazilian city?", answer: "Rio de Janeiro", variants: ["Rio"] },

  // Islands
  { category: "Geography", topic: "Islands", prompt: "What is the world's largest island that is not a continent?", answer: "Greenland", variants: ["Greenland"] },
  { category: "Geography", topic: "Islands", prompt: "Which large island off Africa's southeast coast is famous for its lemurs?", answer: "Madagascar", variants: ["Madagascar"] },
  { category: "Geography", topic: "Islands", prompt: "Which is the only US state made up entirely of islands?", answer: "Hawaii", variants: ["Hawaii"] },
  { category: "Geography", topic: "Islands", prompt: "Which Indonesian island is the most populous island on Earth?", answer: "Java", variants: ["Java"] },

  // Volcanoes
  { category: "Geography", topic: "Volcanoes", prompt: "Which volcano destroyed the Roman city of Pompeii in 79 AD?", answer: "Mount Vesuvius", variants: ["Vesuvius"] },
  { category: "Geography", topic: "Volcanoes", prompt: "A dormant supervolcano caldera lies beneath which US national park?", answer: "Yellowstone", variants: ["Yellowstone Caldera"] },
  { category: "Geography", topic: "Volcanoes", prompt: "Which Italian island volcano is nicknamed the 'Lighthouse of the Mediterranean'?", answer: "Stromboli", variants: ["Stromboli"] },
  { category: "Geography", topic: "Volcanoes", prompt: "The catastrophic 1883 eruption of which Indonesian volcano was heard thousands of miles away?", answer: "Krakatoa", variants: ["Krakatau"] },

  // Borders
  { category: "Geography", topic: "Borders", prompt: "Which two countries share the longest international border in the world?", answer: "US and Canada", variants: ["Canada and US", "USA-Canada", "United States and Canada"] },
  { category: "Geography", topic: "Borders", prompt: "The 38th parallel roughly divides which two countries?", answer: "North and South Korea", variants: ["the Koreas", "North Korea and South Korea"] },
  { category: "Geography", topic: "Borders", prompt: "Which river forms much of the border between the United States and Mexico?", answer: "Rio Grande", variants: ["Rio Grande", "Rio Bravo"] },
  { category: "Geography", topic: "Borders", prompt: "Which tiny country is landlocked between France and Spain in the Pyrenees?", answer: "Andorra", variants: ["Andorra"] },

  // Map Trivia
  { category: "Geography", topic: "Map Trivia", prompt: "What is the longest line of latitude on Earth?", answer: "Equator", variants: ["the Equator"] },
  { category: "Geography", topic: "Map Trivia", prompt: "Vertical map lines measuring position east or west are called lines of what?", answer: "Longitude", variants: ["lines of longitude", "meridians"] },
  { category: "Geography", topic: "Map Trivia", prompt: "The Prime Meridian passes through which observatory in London?", answer: "Greenwich", variants: ["Royal Greenwich Observatory", "Greenwich Observatory"] },
  { category: "Geography", topic: "Map Trivia", prompt: "Which common map projection famously exaggerates the size of Greenland?", answer: "Mercator", variants: ["Mercator projection"] },

  // ===================== LITERATURE =====================

  // Shakespeare
  { category: "Literature", topic: "Shakespeare", prompt: "In which Italian city is 'Romeo and Juliet' primarily set?", answer: "Verona", variants: ["Verona"] },
  { category: "Literature", topic: "Shakespeare", prompt: "Which Shakespeare play features the courtiers Rosencrantz and Guildenstern?", answer: "Hamlet", variants: ["Hamlet"] },
  { category: "Literature", topic: "Shakespeare", prompt: "'Is this a dagger which I see before me' comes from which tragedy?", answer: "Macbeth", variants: ["Macbeth"] },
  { category: "Literature", topic: "Shakespeare", prompt: "How many sonnets did Shakespeare write in total?", answer: "154", variants: ["154 sonnets"] },

  // Classic Novels
  { category: "Literature", topic: "Classic Novels", prompt: "Who wrote the 1813 novel 'Pride and Prejudice'?", answer: "Jane Austen", variants: ["Austen"] },
  { category: "Literature", topic: "Classic Novels", prompt: "In 'Moby-Dick', what is the name of the whaling ship's obsessed captain?", answer: "Captain Ahab", variants: ["Ahab"] },
  { category: "Literature", topic: "Classic Novels", prompt: "Which Tolstoy novel opens with a famous line about happy and unhappy families?", answer: "Anna Karenina", variants: ["Anna Karenina"] },
  { category: "Literature", topic: "Classic Novels", prompt: "Who wrote the Russian novel 'Crime and Punishment'?", answer: "Fyodor Dostoevsky", variants: ["Dostoevsky", "Dostoyevsky"] },

  // 20th Century Fiction
  { category: "Literature", topic: "20th Century Fiction", prompt: "Who wrote the dystopian novel '1984'?", answer: "George Orwell", variants: ["Orwell"] },
  { category: "Literature", topic: "20th Century Fiction", prompt: "Which 1960 Harper Lee novel is set in Maycomb, Alabama?", answer: "To Kill a Mockingbird", variants: ["To Kill a Mockingbird"] },
  { category: "Literature", topic: "20th Century Fiction", prompt: "Who wrote 'The Great Gatsby'?", answer: "F. Scott Fitzgerald", variants: ["Fitzgerald", "Scott Fitzgerald"] },
  { category: "Literature", topic: "20th Century Fiction", prompt: "What is the fictional town in Garcia Marquez's 'One Hundred Years of Solitude'?", answer: "Macondo", variants: ["Macondo"] },

  // Poetry
  { category: "Literature", topic: "Poetry", prompt: "Who wrote the narrative poem 'The Raven'?", answer: "Edgar Allan Poe", variants: ["Poe", "Edgar Allen Poe"] },
  { category: "Literature", topic: "Poetry", prompt: "'Do not go gentle into that good night' was written by which Welsh poet?", answer: "Dylan Thomas", variants: ["Thomas"] },
  { category: "Literature", topic: "Poetry", prompt: "Which American poet wrote 'The Road Not Taken'?", answer: "Robert Frost", variants: ["Frost"] },
  { category: "Literature", topic: "Poetry", prompt: "Homer's epic poem about Odysseus's long voyage home is called what?", answer: "The Odyssey", variants: ["Odyssey"] },

  // Children's Books
  { category: "Literature", topic: "Children's Books", prompt: "Who wrote 'The Cat in the Hat' and 'Green Eggs and Ham'?", answer: "Dr. Seuss", variants: ["Seuss", "Theodor Geisel"] },
  { category: "Literature", topic: "Children's Books", prompt: "In 'Charlotte's Web', what kind of animal is Charlotte?", answer: "Spider", variants: ["a spider"] },
  { category: "Literature", topic: "Children's Books", prompt: "Which creature eats through a week of food in Eric Carle's classic picture book?", answer: "Caterpillar", variants: ["The Very Hungry Caterpillar", "a caterpillar"] },
  { category: "Literature", topic: "Children's Books", prompt: "What is the name of A.A. Milne's honey-loving bear of the Hundred Acre Wood?", answer: "Winnie-the-Pooh", variants: ["Winnie the Pooh", "Pooh", "Pooh Bear"] },

  // Fantasy
  { category: "Literature", topic: "Fantasy", prompt: "Who wrote 'The Lord of the Rings'?", answer: "J.R.R. Tolkien", variants: ["Tolkien"] },
  { category: "Literature", topic: "Fantasy", prompt: "What is the Stark family motto in George R.R. Martin's 'A Song of Ice and Fire'?", answer: "Winter is Coming", variants: ["Winter Is Coming"] },
  { category: "Literature", topic: "Fantasy", prompt: "Which C.S. Lewis series features a wardrobe leading to a magical land?", answer: "The Chronicles of Narnia", variants: ["Chronicles of Narnia", "Narnia"] },
  { category: "Literature", topic: "Fantasy", prompt: "In Tolkien's world, what is the name of the hobbits' green homeland?", answer: "The Shire", variants: ["Shire"] },

  // Sci-Fi
  { category: "Literature", topic: "Sci-Fi", prompt: "Who wrote the 1965 science-fiction epic 'Dune'?", answer: "Frank Herbert", variants: ["Herbert"] },
  { category: "Literature", topic: "Sci-Fi", prompt: "Which author wrote the 'Foundation' series and devised the Three Laws of Robotics?", answer: "Isaac Asimov", variants: ["Asimov"] },
  { category: "Literature", topic: "Sci-Fi", prompt: "In Douglas Adams's 'Hitchhiker's Guide', what number is the Answer to Everything?", answer: "42", variants: ["forty-two"] },
  { category: "Literature", topic: "Sci-Fi", prompt: "Who wrote 'The War of the Worlds' and 'The Time Machine'?", answer: "H.G. Wells", variants: ["Wells", "H. G. Wells"] },

  // Mystery & Crime
  { category: "Literature", topic: "Mystery & Crime", prompt: "Which author created the detective Sherlock Holmes?", answer: "Arthur Conan Doyle", variants: ["Conan Doyle"] },
  { category: "Literature", topic: "Mystery & Crime", prompt: "Which Belgian detective was created by Agatha Christie?", answer: "Hercule Poirot", variants: ["Poirot"] },
  { category: "Literature", topic: "Mystery & Crime", prompt: "What is the surname of Agatha Christie's elderly spinster sleuth, Miss Jane?", answer: "Marple", variants: ["Miss Marple", "Jane Marple"] },
  { category: "Literature", topic: "Mystery & Crime", prompt: "What is Sherlock Holmes's London address?", answer: "221B Baker Street", variants: ["221B Baker St", "221b Baker Street"] },

  // Harry Potter
  { category: "Literature", topic: "Harry Potter", prompt: "What position does Harry play on his Quidditch team?", answer: "Seeker", variants: ["Seeker"] },
  { category: "Literature", topic: "Harry Potter", prompt: "What is the name of Harry's pet snowy owl?", answer: "Hedwig", variants: ["Hedwig"] },
  { category: "Literature", topic: "Harry Potter", prompt: "Which Hogwarts house has a serpent as its emblem?", answer: "Slytherin", variants: ["Slytherin"] },
  { category: "Literature", topic: "Harry Potter", prompt: "What is the term for an object concealing a fragment of Voldemort's soul?", answer: "Horcrux", variants: ["Horcruxes", "a Horcrux"] },

  // Greek Mythology
  { category: "Literature", topic: "Greek Mythology", prompt: "Who is the Greek king of the gods, ruler of Mount Olympus?", answer: "Zeus", variants: ["Zeus"] },
  { category: "Literature", topic: "Greek Mythology", prompt: "Which Greek warrior was invulnerable except for his heel?", answer: "Achilles", variants: ["Achilles"] },
  { category: "Literature", topic: "Greek Mythology", prompt: "Which goddess of wisdom sprang fully grown from Zeus's head?", answer: "Athena", variants: ["Athena"] },
  { category: "Literature", topic: "Greek Mythology", prompt: "Which snake-haired Gorgon turned onlookers to stone?", answer: "Medusa", variants: ["Medusa"] },

  // Famous Authors
  { category: "Literature", topic: "Famous Authors", prompt: "Which American author wrote 'Huckleberry Finn' under a riverboat pen name?", answer: "Mark Twain", variants: ["Twain", "Samuel Clemens"] },
  { category: "Literature", topic: "Famous Authors", prompt: "Which English author created Oliver Twist and Ebenezer Scrooge?", answer: "Charles Dickens", variants: ["Dickens"] },
  { category: "Literature", topic: "Famous Authors", prompt: "Which reclusive American poet is known as the 'Belle of Amherst'?", answer: "Emily Dickinson", variants: ["Dickinson"] },
  { category: "Literature", topic: "Famous Authors", prompt: "Which Colombian author won the 1982 Nobel Prize in Literature?", answer: "Gabriel Garcia Marquez", variants: ["Garcia Marquez", "Marquez"] },

  // Banned Books
  { category: "Literature", topic: "Banned Books", prompt: "Which J.D. Salinger novel is among the most challenged books in US schools?", answer: "The Catcher in the Rye", variants: ["Catcher in the Rye"] },
  { category: "Literature", topic: "Banned Books", prompt: "Which Mark Twain novel is frequently banned over its racial language?", answer: "Adventures of Huckleberry Finn", variants: ["Huckleberry Finn", "Huck Finn"] },
  { category: "Literature", topic: "Banned Books", prompt: "In Ray Bradbury's 'Fahrenheit 451', what do the firemen do to books?", answer: "Burn them", variants: ["burning books", "burns books", "burn"] },
  { category: "Literature", topic: "Banned Books", prompt: "Which frequently challenged Margaret Atwood novel is set in Gilead?", answer: "The Handmaid's Tale", variants: ["Handmaid's Tale"] },

  // Pulitzer Winners
  { category: "Literature", topic: "Pulitzer Winners", prompt: "Which Margaret Mitchell Civil War novel won the 1937 Pulitzer?", answer: "Gone with the Wind", variants: ["Gone with the Wind"] },
  { category: "Literature", topic: "Pulitzer Winners", prompt: "Which Steinbeck novel about the Joad family won the 1940 Pulitzer?", answer: "The Grapes of Wrath", variants: ["Grapes of Wrath"] },
  { category: "Literature", topic: "Pulitzer Winners", prompt: "Which Donna Tartt novel about a stolen painting won the 2014 Pulitzer?", answer: "The Goldfinch", variants: ["The Goldfinch"] },
  { category: "Literature", topic: "Pulitzer Winners", prompt: "Which Cormac McCarthy post-apocalyptic novel won the 2007 Pulitzer?", answer: "The Road", variants: ["The Road"] },

  // Modern Bestsellers
  { category: "Literature", topic: "Modern Bestsellers", prompt: "Who wrote the 2003 thriller 'The Da Vinci Code'?", answer: "Dan Brown", variants: ["Brown"] },
  { category: "Literature", topic: "Modern Bestsellers", prompt: "Which author wrote the thrillers 'Gone Girl' and 'Sharp Objects'?", answer: "Gillian Flynn", variants: ["Flynn"] },
  { category: "Literature", topic: "Modern Bestsellers", prompt: "Who wrote 'The Girl with the Dragon Tattoo'?", answer: "Stieg Larsson", variants: ["Larsson"] },
  { category: "Literature", topic: "Modern Bestsellers", prompt: "Which author's BookTok hit 'It Ends with Us' topped bestseller lists?", answer: "Colleen Hoover", variants: ["Hoover"] },

  // First Lines
  { category: "Literature", topic: "First Lines", prompt: "'Call me Ishmael' opens which American novel?", answer: "Moby-Dick", variants: ["Moby Dick"] },
  { category: "Literature", topic: "First Lines", prompt: "'It was the best of times, it was the worst of times' opens which Dickens novel?", answer: "A Tale of Two Cities", variants: ["Tale of Two Cities"] },
  { category: "Literature", topic: "First Lines", prompt: "'It is a truth universally acknowledged...' opens which Austen novel?", answer: "Pride and Prejudice", variants: ["Pride & Prejudice"] },
  { category: "Literature", topic: "First Lines", prompt: "'...the clocks were striking thirteen' ends the first line of which novel?", answer: "1984", variants: ["Nineteen Eighty-Four"] },

  // ===================== ENTERTAINMENT =====================

  // Disney
  { category: "Entertainment", topic: "Disney", prompt: "Which 1937 film was Disney's first full-length animated feature?", answer: "Snow White and the Seven Dwarfs", variants: ["Snow White"] },
  { category: "Entertainment", topic: "Disney", prompt: "In 'The Lion King', what is the name of Simba's villainous uncle?", answer: "Scar", variants: ["Scar"] },
  { category: "Entertainment", topic: "Disney", prompt: "What is the name of the pull-string cowboy in 'Toy Story'?", answer: "Woody", variants: ["Sheriff Woody"] },
  { category: "Entertainment", topic: "Disney", prompt: "In 'Frozen', which sister possesses ice and snow powers?", answer: "Elsa", variants: ["Elsa"] },

  // 90s Movies
  { category: "Entertainment", topic: "90s Movies", prompt: "Which 1993 Spielberg blockbuster featured cloned dinosaurs on an island park?", answer: "Jurassic Park", variants: ["Jurassic Park"] },
  { category: "Entertainment", topic: "90s Movies", prompt: "In 'Pulp Fiction', what do the hitmen call a Quarter Pounder in Paris?", answer: "Royale with Cheese", variants: ["a Royale with Cheese"] },
  { category: "Entertainment", topic: "90s Movies", prompt: "Which 1994 film features the line 'Life is like a box of chocolates'?", answer: "Forrest Gump", variants: ["Forrest Gump"] },
  { category: "Entertainment", topic: "90s Movies", prompt: "Which 1999 thriller features the twist line 'I see dead people'?", answer: "The Sixth Sense", variants: ["Sixth Sense"] },

  // Marvel
  { category: "Entertainment", topic: "Marvel", prompt: "What is the real name of Iron Man?", answer: "Tony Stark", variants: ["Stark", "Anthony Stark"] },
  { category: "Entertainment", topic: "Marvel", prompt: "What fictional metal coats Wolverine's skeleton and claws?", answer: "Adamantium", variants: ["Adamantium"] },
  { category: "Entertainment", topic: "Marvel", prompt: "Which Infinity Stone was hidden in Loki's scepter and later set in Vision's forehead?", answer: "Mind Stone", variants: ["the Mind Stone"] },
  { category: "Entertainment", topic: "Marvel", prompt: "What is the rare Wakandan metal used in Black Panther's suit?", answer: "Vibranium", variants: ["Vibranium"] },

  // Star Wars
  { category: "Entertainment", topic: "Star Wars", prompt: "Who is revealed to be Luke Skywalker's father?", answer: "Darth Vader", variants: ["Anakin Skywalker", "Vader", "Anakin"] },
  { category: "Entertainment", topic: "Star Wars", prompt: "What is the name of Han Solo's Corellian freighter?", answer: "Millennium Falcon", variants: ["the Millennium Falcon"] },
  { category: "Entertainment", topic: "Star Wars", prompt: "Which small green Jedi Master trains Luke on the swamp planet Dagobah?", answer: "Yoda", variants: ["Yoda"] },
  { category: "Entertainment", topic: "Star Wars", prompt: "On which desert planet did Luke Skywalker grow up?", answer: "Tatooine", variants: ["Tatooine"] },

  // Sitcoms
  { category: "Entertainment", topic: "Sitcoms", prompt: "What is the name of the coffee house where the 'Friends' gang hangs out?", answer: "Central Perk", variants: ["Central Perk"] },
  { category: "Entertainment", topic: "Sitcoms", prompt: "In 'Seinfeld', what is the surname of Jerry's across-the-hall neighbor Cosmo?", answer: "Kramer", variants: ["Cosmo Kramer"] },
  { category: "Entertainment", topic: "Sitcoms", prompt: "What is the name of the paper company in the US version of 'The Office'?", answer: "Dunder Mifflin", variants: ["Dunder Mifflin"] },
  { category: "Entertainment", topic: "Sitcoms", prompt: "In which fictional Indiana town is 'Parks and Recreation' set?", answer: "Pawnee", variants: ["Pawnee"] },

  // Pop Music
  { category: "Entertainment", topic: "Pop Music", prompt: "Whose 1982 album 'Thriller' is the best-selling album of all time?", answer: "Michael Jackson", variants: ["Jackson", "MJ"] },
  { category: "Entertainment", topic: "Pop Music", prompt: "Which artist's record-breaking 'Eras Tour' launched in 2023?", answer: "Taylor Swift", variants: ["Swift"] },
  { category: "Entertainment", topic: "Pop Music", prompt: "Which British singer recorded the album '21' with the hit 'Rolling in the Deep'?", answer: "Adele", variants: ["Adele"] },
  { category: "Entertainment", topic: "Pop Music", prompt: "Which singer is widely known as the 'Queen of Pop'?", answer: "Madonna", variants: ["Madonna"] },

  // Classic Rock
  { category: "Entertainment", topic: "Classic Rock", prompt: "Which band recorded the 1973 album 'The Dark Side of the Moon'?", answer: "Pink Floyd", variants: ["Pink Floyd"] },
  { category: "Entertainment", topic: "Classic Rock", prompt: "Who was the flamboyant lead singer of Queen?", answer: "Freddie Mercury", variants: ["Mercury"] },
  { category: "Entertainment", topic: "Classic Rock", prompt: "Which band recorded the epic 'Stairway to Heaven'?", answer: "Led Zeppelin", variants: ["Zeppelin"] },
  { category: "Entertainment", topic: "Classic Rock", prompt: "Which 1969 Beatles album cover shows the band on a zebra crossing?", answer: "Abbey Road", variants: ["Abbey Road"] },

  // Broadway
  { category: "Entertainment", topic: "Broadway", prompt: "Which musical tells the untold story of the witches of Oz, with 'Defying Gravity'?", answer: "Wicked", variants: ["Wicked"] },
  { category: "Entertainment", topic: "Broadway", prompt: "Lin-Manuel Miranda wrote which hip-hop musical about a US founding father?", answer: "Hamilton", variants: ["Hamilton"] },
  { category: "Entertainment", topic: "Broadway", prompt: "Which long-running Lloyd Webber musical is based on T.S. Eliot's poems about felines?", answer: "Cats", variants: ["Cats"] },
  { category: "Entertainment", topic: "Broadway", prompt: "Which musical features a masked figure haunting a Paris opera house?", answer: "The Phantom of the Opera", variants: ["Phantom of the Opera", "Phantom"] },

  // Reality TV
  { category: "Entertainment", topic: "Reality TV", prompt: "Which Gordon Ramsay cooking competition has 'Hell's' in its title?", answer: "Hell's Kitchen", variants: ["Hell's Kitchen"] },
  { category: "Entertainment", topic: "Reality TV", prompt: "Which CBS show crowns a 'Sole Survivor' after strands of tribal competition?", answer: "Survivor", variants: ["Survivor"] },
  { category: "Entertainment", topic: "Reality TV", prompt: "Which dating show features a single man handing out roses to contestants?", answer: "The Bachelor", variants: ["The Bachelor"] },
  { category: "Entertainment", topic: "Reality TV", prompt: "Which family's reality show 'Keeping Up with...' ran from 2007 to 2021?", answer: "The Kardashians", variants: ["Kardashians", "Keeping Up with the Kardashians"] },

  // Video Games
  { category: "Entertainment", topic: "Video Games", prompt: "Which mustachioed plumber is Nintendo's flagship mascot?", answer: "Mario", variants: ["Super Mario"] },
  { category: "Entertainment", topic: "Video Games", prompt: "In 'The Legend of Zelda', what is the name of the elf-like hero the player controls?", answer: "Link", variants: ["Link"] },
  { category: "Entertainment", topic: "Video Games", prompt: "Which block-building sandbox game by Mojang is the best-selling of all time?", answer: "Minecraft", variants: ["Minecraft"] },
  { category: "Entertainment", topic: "Video Games", prompt: "Which yellow arcade character eats dots while fleeing four ghosts?", answer: "Pac-Man", variants: ["Pacman", "Pac Man"] },

  // The Oscars
  { category: "Entertainment", topic: "The Oscars", prompt: "Which 1997 film won 11 Academy Awards, tying the all-time record?", answer: "Titanic", variants: ["Titanic"] },
  { category: "Entertainment", topic: "The Oscars", prompt: "Which 2020 Best Picture winner was the first non-English-language film to win?", answer: "Parasite", variants: ["Parasite"] },
  { category: "Entertainment", topic: "The Oscars", prompt: "Which actress holds the record for most competitive acting Oscars, with four?", answer: "Katharine Hepburn", variants: ["Hepburn"] },
  { category: "Entertainment", topic: "The Oscars", prompt: "Which performer holds the record for most Oscar acting nominations?", answer: "Meryl Streep", variants: ["Streep"] },

  // Animated Films
  { category: "Entertainment", topic: "Animated Films", prompt: "Which 2001 film was the first winner of the Oscar for Best Animated Feature?", answer: "Shrek", variants: ["Shrek"] },
  { category: "Entertainment", topic: "Animated Films", prompt: "Which Studio Ghibli film follows a girl named Chihiro trapped in a spirit bathhouse?", answer: "Spirited Away", variants: ["Spirited Away"] },
  { category: "Entertainment", topic: "Animated Films", prompt: "Which Pixar film opens with an old man flying his house with balloons?", answer: "Up", variants: ["Up"] },
  { category: "Entertainment", topic: "Animated Films", prompt: "In 'Finding Nemo', what species of fish are Nemo and his father?", answer: "Clownfish", variants: ["clown fish"] },

  // Horror Movies
  { category: "Entertainment", topic: "Horror Movies", prompt: "Which 1960 Hitchcock film is famous for a shocking shower scene?", answer: "Psycho", variants: ["Psycho"] },
  { category: "Entertainment", topic: "Horror Movies", prompt: "What is the name of the white-masked killer in the 'Halloween' films?", answer: "Michael Myers", variants: ["Myers"] },
  { category: "Entertainment", topic: "Horror Movies", prompt: "Which 1975 Spielberg film made audiences afraid to go in the water?", answer: "Jaws", variants: ["Jaws"] },
  { category: "Entertainment", topic: "Horror Movies", prompt: "In 'The Shining', what word does 'REDRUM' spell backwards?", answer: "Murder", variants: ["murder"] },

  // Streaming Shows
  { category: "Entertainment", topic: "Streaming Shows", prompt: "Which Netflix series follows kids in Hawkins fighting creatures from the Upside Down?", answer: "Stranger Things", variants: ["Stranger Things"] },
  { category: "Entertainment", topic: "Streaming Shows", prompt: "Which Korean survival-game drama became Netflix's biggest hit of 2021?", answer: "Squid Game", variants: ["Squid Game"] },
  { category: "Entertainment", topic: "Streaming Shows", prompt: "Which HBO fantasy epic is based on George R.R. Martin's novels?", answer: "Game of Thrones", variants: ["GoT"] },
  { category: "Entertainment", topic: "Streaming Shows", prompt: "Which Disney+ series features a bounty hunter protecting Grogu, or 'Baby Yoda'?", answer: "The Mandalorian", variants: ["Mandalorian"] },

  // Boy Bands
  { category: "Entertainment", topic: "Boy Bands", prompt: "Which boy band launched Justin Timberlake before his solo career?", answer: "NSYNC", variants: ["*NSYNC", "N Sync"] },
  { category: "Entertainment", topic: "Boy Bands", prompt: "Which British-Irish group, formed on 'The X Factor', launched Harry Styles?", answer: "One Direction", variants: ["1D"] },
  { category: "Entertainment", topic: "Boy Bands", prompt: "Which 1990s group recorded 'I Want It That Way'?", answer: "Backstreet Boys", variants: ["BSB", "the Backstreet Boys"] },
  { category: "Entertainment", topic: "Boy Bands", prompt: "Which South Korean group became the world's biggest boy band in the late 2010s?", answer: "BTS", variants: ["Bangtan Boys"] },

  // ===================== SCIENCE & NATURE =====================

  // Space
  { category: "Science & Nature", topic: "Space", prompt: "Which planet is the largest in our solar system?", answer: "Jupiter", variants: ["Jupiter"] },
  { category: "Science & Nature", topic: "Space", prompt: "What is the name of the galaxy containing our solar system?", answer: "Milky Way", variants: ["the Milky Way"] },
  { category: "Science & Nature", topic: "Space", prompt: "Which planet is best known for its prominent ring system?", answer: "Saturn", variants: ["Saturn"] },
  { category: "Science & Nature", topic: "Space", prompt: "What was the first artificial satellite, launched by the USSR in 1957?", answer: "Sputnik", variants: ["Sputnik 1"] },

  // The Human Body
  { category: "Science & Nature", topic: "The Human Body", prompt: "What is the largest organ of the human body?", answer: "Skin", variants: ["the skin"] },
  { category: "Science & Nature", topic: "The Human Body", prompt: "How many bones are in the adult human body?", answer: "206", variants: ["206 bones"] },
  { category: "Science & Nature", topic: "The Human Body", prompt: "Which organ produces the hormone insulin?", answer: "Pancreas", variants: ["the pancreas"] },
  { category: "Science & Nature", topic: "The Human Body", prompt: "What is the smallest bone in the human body, located in the ear?", answer: "Stapes", variants: ["the stapes", "stirrup"] },

  // Animals
  { category: "Science & Nature", topic: "Animals", prompt: "What is the largest living land animal?", answer: "African elephant", variants: ["elephant", "African bush elephant"] },
  { category: "Science & Nature", topic: "Animals", prompt: "What is the fastest land animal over short distances?", answer: "Cheetah", variants: ["cheetah"] },
  { category: "Science & Nature", topic: "Animals", prompt: "What is the only mammal capable of true, sustained flight?", answer: "Bat", variants: ["bats"] },
  { category: "Science & Nature", topic: "Animals", prompt: "What collective noun is used for a group of lions?", answer: "Pride", variants: ["a pride"] },

  // Chemistry
  { category: "Science & Nature", topic: "Chemistry", prompt: "What is the chemical symbol for gold?", answer: "Au", variants: ["Au"] },
  { category: "Science & Nature", topic: "Chemistry", prompt: "Which gas do plants primarily take in for photosynthesis?", answer: "Carbon dioxide", variants: ["CO2"] },
  { category: "Science & Nature", topic: "Chemistry", prompt: "What is the most abundant gas in Earth's atmosphere?", answer: "Nitrogen", variants: ["N2"] },
  { category: "Science & Nature", topic: "Chemistry", prompt: "What is the pH of a perfectly neutral solution at room temperature?", answer: "7", variants: ["seven"] },

  // Physics
  { category: "Science & Nature", topic: "Physics", prompt: "Approximately how fast does light travel in a vacuum, in km per second?", answer: "300,000", variants: ["300000", "299,792 km/s", "299792"] },
  { category: "Science & Nature", topic: "Physics", prompt: "Which scientist formulated the theory of general relativity?", answer: "Albert Einstein", variants: ["Einstein"] },
  { category: "Science & Nature", topic: "Physics", prompt: "Which fundamental force keeps the planets in orbit around the Sun?", answer: "Gravity", variants: ["gravitational force"] },
  { category: "Science & Nature", topic: "Physics", prompt: "What is the SI unit of force, named after a famous English physicist?", answer: "Newton", variants: ["the newton"] },

  // Geology
  { category: "Science & Nature", topic: "Geology", prompt: "What is the hardest naturally occurring mineral?", answer: "Diamond", variants: ["diamond"] },
  { category: "Science & Nature", topic: "Geology", prompt: "Earthquake magnitude was historically measured on which named scale?", answer: "Richter scale", variants: ["Richter"] },
  { category: "Science & Nature", topic: "Geology", prompt: "What is the term for molten rock still beneath the Earth's surface?", answer: "Magma", variants: ["magma"] },
  { category: "Science & Nature", topic: "Geology", prompt: "What name is given to the supercontinent that existed about 300 million years ago?", answer: "Pangaea", variants: ["Pangea"] },

  // Weather
  { category: "Science & Nature", topic: "Weather", prompt: "Which instrument measures atmospheric pressure?", answer: "Barometer", variants: ["a barometer"] },
  { category: "Science & Nature", topic: "Weather", prompt: "What is the term for a violently rotating column of air touching the ground?", answer: "Tornado", variants: ["a tornado"] },
  { category: "Science & Nature", topic: "Weather", prompt: "Tornado intensity is rated on which modern scale?", answer: "Enhanced Fujita scale", variants: ["Fujita scale", "EF scale"] },
  { category: "Science & Nature", topic: "Weather", prompt: "What is a powerful tropical cyclone in the Atlantic Ocean called?", answer: "Hurricane", variants: ["a hurricane"] },

  // Dinosaurs
  { category: "Science & Nature", topic: "Dinosaurs", prompt: "Dinosaurs went extinct at the end of which geological period?", answer: "Cretaceous", variants: ["Cretaceous period", "the Cretaceous"] },
  { category: "Science & Nature", topic: "Dinosaurs", prompt: "Which three-horned, frilled dinosaur is named for its distinctive face?", answer: "Triceratops", variants: ["Triceratops"] },
  { category: "Science & Nature", topic: "Dinosaurs", prompt: "What type of impact is the leading theory for the dinosaurs' extinction?", answer: "Asteroid", variants: ["asteroid impact", "meteor impact"] },
  { category: "Science & Nature", topic: "Dinosaurs", prompt: "The dinosaurs lived during which era, the 'Age of Reptiles'?", answer: "Mesozoic", variants: ["Mesozoic Era", "the Mesozoic"] },

  // Plants
  { category: "Science & Nature", topic: "Plants", prompt: "What is the process by which plants convert sunlight into chemical energy?", answer: "Photosynthesis", variants: ["photosynthesis"] },
  { category: "Science & Nature", topic: "Plants", prompt: "Which green pigment in leaves captures light for photosynthesis?", answer: "Chlorophyll", variants: ["chlorophyll"] },
  { category: "Science & Nature", topic: "Plants", prompt: "What is the tallest species of tree in the world, native to California?", answer: "Coast redwood", variants: ["redwood"] },
  { category: "Science & Nature", topic: "Plants", prompt: "Which part of a plant mainly absorbs water and nutrients from the soil?", answer: "Roots", variants: ["root", "the roots"] },

  // Inventions
  { category: "Science & Nature", topic: "Inventions", prompt: "Who is most often credited with inventing the practical incandescent light bulb?", answer: "Thomas Edison", variants: ["Edison"] },
  { category: "Science & Nature", topic: "Inventions", prompt: "Which two brothers made the first powered airplane flight in 1903?", answer: "Wright brothers", variants: ["the Wright brothers", "Wright"] },
  { category: "Science & Nature", topic: "Inventions", prompt: "Who patented the telephone in 1876?", answer: "Alexander Graham Bell", variants: ["Bell", "Graham Bell"] },
  { category: "Science & Nature", topic: "Inventions", prompt: "Who invented the movable-type printing press around 1440?", answer: "Johannes Gutenberg", variants: ["Gutenberg"] },

  // The Ocean
  { category: "Science & Nature", topic: "The Ocean", prompt: "What is the deepest known point in the world's oceans?", answer: "Mariana Trench", variants: ["the Mariana Trench", "Challenger Deep"] },
  { category: "Science & Nature", topic: "The Ocean", prompt: "Roughly what percentage of Earth's surface is covered by ocean?", answer: "71%", variants: ["71", "70%"] },
  { category: "Science & Nature", topic: "The Ocean", prompt: "What is the largest animal ever known to have lived, found in the ocean?", answer: "Blue whale", variants: ["blue whale"] },
  { category: "Science & Nature", topic: "The Ocean", prompt: "What is the name of the world's largest coral reef system, off Australia?", answer: "Great Barrier Reef", variants: ["the Great Barrier Reef"] },

  // Genetics
  { category: "Science & Nature", topic: "Genetics", prompt: "What is the full chemical name of the molecule abbreviated DNA?", answer: "Deoxyribonucleic acid", variants: ["deoxyribonucleic acid"] },
  { category: "Science & Nature", topic: "Genetics", prompt: "What is the twisted-ladder shape of the DNA molecule called?", answer: "Double helix", variants: ["a double helix"] },
  { category: "Science & Nature", topic: "Genetics", prompt: "How many pairs of chromosomes are in a typical human body cell?", answer: "23", variants: ["23 pairs", "twenty-three"] },
  { category: "Science & Nature", topic: "Genetics", prompt: "Which monk is called the father of genetics for his work with pea plants?", answer: "Gregor Mendel", variants: ["Mendel"] },

  // Astronomy
  { category: "Science & Nature", topic: "Astronomy", prompt: "What is the closest star to Earth?", answer: "The Sun", variants: ["Sun", "Sol"] },
  { category: "Science & Nature", topic: "Astronomy", prompt: "What is the nearest star to our solar system beyond the Sun?", answer: "Proxima Centauri", variants: ["Proxima Centauri"] },
  { category: "Science & Nature", topic: "Astronomy", prompt: "What is the term for the explosive death of a massive star?", answer: "Supernova", variants: ["a supernova"] },
  { category: "Science & Nature", topic: "Astronomy", prompt: "Which planet rotates on its side, tilted about 98 degrees?", answer: "Uranus", variants: ["Uranus"] },

  // The Periodic Table
  { category: "Science & Nature", topic: "The Periodic Table", prompt: "Which element sits first on the periodic table?", answer: "Hydrogen", variants: ["hydrogen", "H"] },
  { category: "Science & Nature", topic: "The Periodic Table", prompt: "What is the chemical symbol for iron?", answer: "Fe", variants: ["Fe"] },
  { category: "Science & Nature", topic: "The Periodic Table", prompt: "What is the chemical symbol for sodium?", answer: "Na", variants: ["Na"] },
  { category: "Science & Nature", topic: "The Periodic Table", prompt: "Which group of unreactive elements includes helium, neon, and argon?", answer: "Noble gases", variants: ["noble gases", "inert gases"] },

  // Ecology
  { category: "Science & Nature", topic: "Ecology", prompt: "What term describes a community of organisms together with their physical environment?", answer: "Ecosystem", variants: ["an ecosystem"] },
  { category: "Science & Nature", topic: "Ecology", prompt: "What is the term for an animal that eats only plants?", answer: "Herbivore", variants: ["a herbivore"] },
  { category: "Science & Nature", topic: "Ecology", prompt: "What label is given to a species at serious risk of extinction?", answer: "Endangered species", variants: ["endangered"] },
  { category: "Science & Nature", topic: "Ecology", prompt: "What single word describes the variety of living species in a habitat?", answer: "Biodiversity", variants: ["biological diversity"] },

  // ===================== GAME-DAY HARD ADDITIONS (2026-11-07) =====================
  // Custom topics captains typed that weren't in the catalog, plus harder
  // questions for in-use topics. All flagged hard so the generator prefers them.

  // Colorado Mountains (custom)
  { category: "Geography", topic: "Colorado Mountains", prompt: "What is the highest peak in Colorado, at 14,440 feet?", answer: "Mount Elbert", variants: ["Elbert"], hard: true },
  { category: "Geography", topic: "Colorado Mountains", prompt: "The view from which Colorado peak inspired Katharine Lee Bates to write 'America the Beautiful'?", answer: "Pikes Peak", variants: ["Pike's Peak", "Pikes"], hard: true },
  { category: "Geography", topic: "Colorado Mountains", prompt: "Which former silver-mining town is the highest incorporated city in the U.S., at over 10,000 feet?", answer: "Leadville", variants: ["Leadville, Colorado"], hard: true },
  { category: "Geography", topic: "Colorado Mountains", prompt: "The Maroon Bells, among the most photographed peaks in North America, sit just outside which Colorado resort town?", answer: "Aspen", variants: ["Aspen, Colorado"], hard: true },
  { category: "Geography", topic: "Colorado Mountains", prompt: "What is the highest peak in Rocky Mountain National Park, at 14,259 feet?", answer: "Longs Peak", variants: ["Long's Peak", "Longs"], hard: true },
  { category: "Geography", topic: "Colorado Mountains", prompt: "Colorado's 50-plus peaks above 14,000 feet are collectively nicknamed what?", answer: "Fourteeners", variants: ["14ers", "14ers"], hard: true },

  // College Football (custom)
  { category: "Sports", topic: "College Football", prompt: "Who is the only player to win the Heisman Trophy twice?", answer: "Archie Griffin", variants: ["Griffin"], hard: true },
  { category: "Sports", topic: "College Football", prompt: "Which two schools play each year in the rivalry known as the 'Iron Bowl'?", answer: "Alabama and Auburn", variants: ["Alabama-Auburn", "Alabama vs Auburn", "Auburn and Alabama"], hard: true },
  { category: "Sports", topic: "College Football", prompt: "Which team won the first College Football Playoff national championship, after the 2014 season?", answer: "Ohio State", variants: ["Buckeyes", "Ohio State Buckeyes"], hard: true },
  { category: "Sports", topic: "College Football", prompt: "Notre Dame's Hesburgh Library mural, visible from the stadium, is nicknamed what?", answer: "Touchdown Jesus", variants: ["Touchdown Jesus"], hard: true },
  { category: "Sports", topic: "College Football", prompt: "Which stadium, home to the Michigan Wolverines, is nicknamed 'The Big House'?", answer: "Michigan Stadium", variants: ["The Big House"], hard: true },
  { category: "Sports", topic: "College Football", prompt: "The Heisman Trophy is named for John Heisman, who coached which Atlanta school to a national title?", answer: "Georgia Tech", variants: ["Georgia Institute of Technology", "Ga Tech"], hard: true },

  // US Geography (custom)
  { category: "Geography", topic: "US Geography", prompt: "Which river forms most of the border between Texas and Mexico?", answer: "Rio Grande", variants: ["the Rio Grande"], hard: true },
  { category: "Geography", topic: "US Geography", prompt: "The Four Corners Monument marks where Utah, Arizona, New Mexico, and which fourth state meet?", answer: "Colorado", variants: ["Colorado"], hard: true },
  { category: "Geography", topic: "US Geography", prompt: "What is the deepest lake in the United States, found in Oregon?", answer: "Crater Lake", variants: ["Crater Lake"], hard: true },
  { category: "Geography", topic: "US Geography", prompt: "Which mountain range runs along the eastern U.S. from Georgia up to Maine?", answer: "Appalachian Mountains", variants: ["the Appalachians", "Appalachians"], hard: true },
  { category: "Geography", topic: "US Geography", prompt: "What is the longest river in the United States?", answer: "Missouri River", variants: ["the Missouri", "Missouri"], hard: true },
  { category: "Geography", topic: "US Geography", prompt: "Which of the five Great Lakes lies entirely within the United States?", answer: "Lake Michigan", variants: ["Michigan"], hard: true },

  // Harry Potter (harder)
  { category: "Literature", topic: "Harry Potter", prompt: "What magical core is inside Harry Potter's wand?", answer: "Phoenix feather", variants: ["a phoenix feather", "phoenix tail feather"], hard: true },
  { category: "Literature", topic: "Harry Potter", prompt: "What form does Severus Snape's Patronus take, mirroring Lily Potter's?", answer: "A doe", variants: ["doe"], hard: true },

  // Horror Movies (harder)
  { category: "Entertainment", topic: "Horror Movies", prompt: "Which 1973 film was the first horror movie nominated for the Best Picture Oscar?", answer: "The Exorcist", variants: ["Exorcist"], hard: true },
  { category: "Entertainment", topic: "Horror Movies", prompt: "What is the name of the burned, razor-gloved killer in 'A Nightmare on Elm Street'?", answer: "Freddy Krueger", variants: ["Freddy Krueger", "Freddy"], hard: true },

  // Baseball (harder)
  { category: "Sports", topic: "Baseball", prompt: "Which Yankees pitcher threw the only perfect game in World Series history, in 1956?", answer: "Don Larsen", variants: ["Larsen"], hard: true },
  { category: "Sports", topic: "Baseball", prompt: "Who became the first player to hit 60 home runs in a single season, in 1927?", answer: "Babe Ruth", variants: ["Ruth"], hard: true },

  // Children's Books (harder)
  { category: "Literature", topic: "Children's Books", prompt: "Which Maurice Sendak book follows a boy named Max to an island of monsters?", answer: "Where the Wild Things Are", variants: ["Where the Wild Things Are"], hard: true },
  { category: "Literature", topic: "Children's Books", prompt: "Which gluttonous boy falls into the chocolate river in Roald Dahl's 'Charlie and the Chocolate Factory'?", answer: "Augustus Gloop", variants: ["Augustus", "Gloop"], hard: true },

  // Animals (harder)
  { category: "Science & Nature", topic: "Animals", prompt: "What is the largest living species of lizard?", answer: "Komodo dragon", variants: ["Komodo dragon"], hard: true },
  { category: "Science & Nature", topic: "Animals", prompt: "Which is the only bird able to fly backwards?", answer: "Hummingbird", variants: ["the hummingbird"], hard: true },

  // Formula 1 (harder)
  { category: "Sports", topic: "Formula 1", prompt: "Which British driver passed Michael Schumacher for the most career Formula 1 race wins?", answer: "Lewis Hamilton", variants: ["Hamilton"], hard: true },
  { category: "Sports", topic: "Formula 1", prompt: "Which driver won the 2021 Formula 1 title on the final lap of the Abu Dhabi Grand Prix?", answer: "Max Verstappen", variants: ["Verstappen"], hard: true },

  // Greek Mythology (harder)
  { category: "Literature", topic: "Greek Mythology", prompt: "Who is the Greek god of the sea, a brother of Zeus and Hades?", answer: "Poseidon", variants: ["Poseidon"], hard: true },
  { category: "Literature", topic: "Greek Mythology", prompt: "Which Greek hero completed twelve labors, beginning with slaying the Nemean Lion?", answer: "Heracles", variants: ["Hercules"], hard: true },

  // Physics (harder)
  { category: "Science & Nature", topic: "Physics", prompt: "Which negatively charged subatomic particle orbits an atom's nucleus?", answer: "Electron", variants: ["an electron"], hard: true },
  { category: "Science & Nature", topic: "Physics", prompt: "What term describes the amount of matter in an object, unchanged by gravity?", answer: "Mass", variants: ["mass"], hard: true },

  // US States (harder)
  { category: "Geography", topic: "US States", prompt: "Which U.S. state has the most counties, with 254?", answer: "Texas", variants: ["Texas"], hard: true },
  { category: "Geography", topic: "US States", prompt: "Michigan is the only U.S. state made up of two separate what?", answer: "Peninsulas", variants: ["peninsulas", "two peninsulas"], hard: true },

  // Reality TV (harder)
  { category: "Entertainment", topic: "Reality TV", prompt: "Which singing competition crowned Kelly Clarkson its first winner in 2002?", answer: "American Idol", variants: ["Idol"], hard: true },
  { category: "Entertainment", topic: "Reality TV", prompt: "Which business competition made Donald Trump's catchphrase 'You're fired' famous?", answer: "The Apprentice", variants: ["Apprentice"], hard: true },

  // ===================== EXPERT TIER (2026-11-07) =====================
  // Toughest questions for the topics in play; preferred above `hard`.

  // US States (expert)
  { category: "Geography", topic: "US States", prompt: "Which U.S. state capital is the least populous, with under 8,000 residents?", answer: "Montpelier", variants: ["Montpelier, Vermont"], hard: true, expert: true },
  { category: "Geography", topic: "US States", prompt: "Which is the only U.S. state named after a U.S. president?", answer: "Washington", variants: ["Washington"], hard: true, expert: true },
  { category: "Geography", topic: "US States", prompt: "Which U.S. state has the most national parks, with nine?", answer: "California", variants: ["California"], hard: true, expert: true },
  { category: "Geography", topic: "US States", prompt: "Jackson is the capital of which U.S. state?", answer: "Mississippi", variants: ["Mississippi"], hard: true, expert: true },
  { category: "Geography", topic: "US States", prompt: "Missouri and which other state each border eight others, the most of any state?", answer: "Tennessee", variants: ["Tennessee"], hard: true, expert: true },
  { category: "Geography", topic: "US States", prompt: "The geographic center of the contiguous 48 states lies in which state?", answer: "Kansas", variants: ["Kansas"], hard: true, expert: true },

  // Reality TV (expert)
  { category: "Entertainment", topic: "Reality TV", prompt: "Which competition show, hosted by Phil Keoghan, sends teams racing around the world?", answer: "The Amazing Race", variants: ["Amazing Race"], hard: true, expert: true },
  { category: "Entertainment", topic: "Reality TV", prompt: "Which villa-set dating show has contestants 'coupling up' each week?", answer: "Love Island", variants: ["Love Island"], hard: true, expert: true },
  { category: "Entertainment", topic: "Reality TV", prompt: "Which married couple stars in HGTV's Waco-set renovation show 'Fixer Upper'?", answer: "Chip and Joanna Gaines", variants: ["the Gaineses", "Chip and Joanna"], hard: true, expert: true },
  { category: "Entertainment", topic: "Reality TV", prompt: "Which competition crowns 'America's Next Drag Superstar', hosted by RuPaul?", answer: "RuPaul's Drag Race", variants: ["Drag Race"], hard: true, expert: true },

  // Formula 1 (expert)
  { category: "Sports", topic: "Formula 1", prompt: "Which Belgian circuit, F1's longest, features the famous Eau Rouge corner?", answer: "Spa-Francorchamps", variants: ["Spa"], hard: true, expert: true },
  { category: "Sports", topic: "Formula 1", prompt: "How many points does a driver earn for winning a Formula 1 Grand Prix?", answer: "25", variants: ["25 points"], hard: true, expert: true },
  { category: "Sports", topic: "Formula 1", prompt: "The Monza circuit, nicknamed the 'Temple of Speed', is in which country?", answer: "Italy", variants: ["Italy"], hard: true, expert: true },

  // Baseball (expert)
  { category: "Sports", topic: "Baseball", prompt: "Who was the last MLB player to bat over .400 in a season, hitting .406 in 1941?", answer: "Ted Williams", variants: ["Williams"], hard: true, expert: true },
  { category: "Sports", topic: "Baseball", prompt: "Who holds the MLB single-season home run record, with 73?", answer: "Barry Bonds", variants: ["Bonds"], hard: true, expert: true },
  { category: "Sports", topic: "Baseball", prompt: "Which 1912 ballpark, MLB's oldest still in use, is home to the Red Sox?", answer: "Fenway Park", variants: ["Fenway"], hard: true, expert: true },

  // Harry Potter (expert)
  { category: "Literature", topic: "Harry Potter", prompt: "The Hogwarts motto 'Draco Dormiens Nunquam Titillandus' translates to what?", answer: "Never tickle a sleeping dragon", variants: ["never tickle a sleeping dragon"], hard: true, expert: true },
  { category: "Literature", topic: "Harry Potter", prompt: "Which goblin-made weapon, embedded with basilisk venom, can destroy Horcruxes?", answer: "The Sword of Gryffindor", variants: ["Sword of Gryffindor", "Gryffindor's sword"], hard: true, expert: true },

  // Horror Movies (expert)
  { category: "Entertainment", topic: "Horror Movies", prompt: "Which 1922 German silent film was an unauthorized adaptation of 'Dracula'?", answer: "Nosferatu", variants: ["Nosferatu"], hard: true, expert: true },
  { category: "Entertainment", topic: "Horror Movies", prompt: "In 'The Silence of the Lambs', what is cannibal Hannibal Lecter's profession?", answer: "Psychiatrist", variants: ["psychiatrist", "forensic psychiatrist"], hard: true, expert: true },

  // Children's Books (expert)
  { category: "Literature", topic: "Children's Books", prompt: "Who wrote the bedtime classic 'Goodnight Moon'?", answer: "Margaret Wise Brown", variants: ["Margaret Wise Brown"], hard: true, expert: true },
  { category: "Literature", topic: "Children's Books", prompt: "In Shel Silverstein's 'The Giving Tree', what kind of tree gives everything to a boy?", answer: "Apple tree", variants: ["apple", "an apple tree"], hard: true, expert: true },

  // Animals (expert)
  { category: "Science & Nature", topic: "Animals", prompt: "What is the only primate known to be venomous?", answer: "Slow loris", variants: ["loris"], hard: true, expert: true },
  { category: "Science & Nature", topic: "Animals", prompt: "What is the ominous collective noun for a group of crows?", answer: "A murder", variants: ["murder"], hard: true, expert: true },

  // Greek Mythology (expert)
  { category: "Literature", topic: "Greek Mythology", prompt: "Who was the ferryman carrying souls across the River Styx into the underworld?", answer: "Charon", variants: ["Charon"], hard: true, expert: true },
  { category: "Literature", topic: "Greek Mythology", prompt: "Which Titan was condemned to hold up the sky for eternity?", answer: "Atlas", variants: ["Atlas"], hard: true, expert: true },

  // Physics (expert)
  { category: "Science & Nature", topic: "Physics", prompt: "What is the boundary around a black hole beyond which not even light escapes?", answer: "Event horizon", variants: ["the event horizon"], hard: true, expert: true },
  { category: "Science & Nature", topic: "Physics", prompt: "Which principle states a particle's exact position and momentum can't both be known?", answer: "Heisenberg Uncertainty Principle", variants: ["uncertainty principle", "Heisenberg"], hard: true, expert: true },

  // College Football (expert)
  { category: "Sports", topic: "College Football", prompt: "Michigan and Ohio State call their storied rivalry simply what?", answer: "The Game", variants: ["The Game"], hard: true, expert: true },
  { category: "Sports", topic: "College Football", prompt: "The Rose Bowl traditionally matched the Big Ten champion against the champion of which conference?", answer: "Pac-12", variants: ["Pac-12", "Pacific-12", "Pac 12"], hard: true, expert: true },
  { category: "Sports", topic: "College Football", prompt: "Minnesota and Michigan play each year for which trophy?", answer: "Little Brown Jug", variants: ["the Little Brown Jug"], hard: true, expert: true },

  // US Geography (expert)
  { category: "Geography", topic: "US Geography", prompt: "What is the lowest point in North America, located in California?", answer: "Death Valley", variants: ["Badwater Basin", "Death Valley"], hard: true, expert: true },
  { category: "Geography", topic: "US Geography", prompt: "Which is the only U.S. state that grows coffee commercially?", answer: "Hawaii", variants: ["Hawaii"], hard: true, expert: true },
  { category: "Geography", topic: "US Geography", prompt: "What is the highest mountain peak in North America, at 20,310 feet?", answer: "Denali", variants: ["Mount McKinley", "Denali"], hard: true, expert: true },

  // Colorado Mountains (expert)
  { category: "Geography", topic: "Colorado Mountains", prompt: "Which Colorado ski resort was founded by veterans of the 10th Mountain Division?", answer: "Vail", variants: ["Vail"], hard: true, expert: true },
  { category: "Geography", topic: "Colorado Mountains", prompt: "The highest paved road in North America climbs which Front Range Colorado peak?", answer: "Mount Evans", variants: ["Mount Blue Sky", "Mount Evans"], hard: true, expert: true },
];
