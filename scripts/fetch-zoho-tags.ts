/**
 * Fetches Associated_Tags from Zoho for candidates that exist in candidates_kpi.
 * Matches by Full_Name (normalized) since emails are not stored in the DB.
 * Paginates all Zoho candidates with minimal fields (Full_Name + Associated_Tags).
 * Outputs JSON to stdout: [{ id (DB id), tags }]
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env
const envContent = readFileSync(resolve(process.cwd(), '.env.production-local'), 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const raw = trimmed.slice(eqIdx + 1).trim()
  const val = raw.replace(/^["']|["']$/g, '')
  if (key && !(key in process.env)) process.env[key] = val
}

// DB candidates: id → full_name (from candidates_kpi, fetched via Supabase MCP)
const DB_CANDIDATES: { id: string; full_name: string }[] = [
  {"id":"88077","full_name":"Adina Rac"},
  {"id":"79721","full_name":"Adrià Rodriguez Guasch"},
  {"id":"91021","full_name":"Adrián Hinojosa Castellano"},
  {"id":"86818","full_name":"Adriana Karina Ribeiro da Costa"},
  {"id":"86825","full_name":"África Ballester"},
  {"id":"88506","full_name":"Agostinho Silva Faria"},
  {"id":"85970","full_name":"Agustín Pardo Amorós"},
  {"id":"88620","full_name":"Aina Puigventos Cano"},
  {"id":"88719","full_name":"Ainhoa Juan Olivares"},
  {"id":"64842","full_name":"Aissatou Bachilly Sisay"},
  {"id":"87334","full_name":"Aissatou Diakité"},
  {"id":"70903","full_name":"Aitana Ciurana Viguer"},
  {"id":"94970","full_name":"Alba Ramos Amaya"},
  {"id":"87389","full_name":"Alejandro (Alex) Costell Montañes"},
  {"id":"84131","full_name":"Alessandro Lanzoni Raiteri"},
  {"id":"94374","full_name":"Alessia Meroni"},
  {"id":"88082","full_name":"Alessia Nicoletti"},
  {"id":"63224","full_name":"Alessio Mazzo"},
  {"id":"92639","full_name":"Alessio Mele"},
  {"id":"90092","full_name":"Alice Peyré"},
  {"id":"87301","full_name":"Alice vandemael"},
  {"id":"83882","full_name":"Alicia García de Andrés"},
  {"id":"93831","full_name":"Alina Isaul"},
  {"id":"78600","full_name":"Álvaro David Arias Ramirez"},
  {"id":"63729","full_name":"Amegnaglo Amouzou Mensah Alowodouna"},
  {"id":"89320","full_name":"Ana Alicia Pérez García"},
  {"id":"88833","full_name":"Ana Alicia Troncoso Caballero"},
  {"id":"91248","full_name":"Ana Belén Martínez Martínez"},
  {"id":"84196","full_name":"Ana Brito Nunes"},
  {"id":"91997","full_name":"Ana García Mira"},
  {"id":"93658","full_name":"Ana Rita Melo"},
  {"id":"90763","full_name":"Ana Sánchez Puerta"},
  {"id":"88052","full_name":"Ana Signes Esteve"},
  {"id":"91869","full_name":"Anamaria Glavasc"},
  {"id":"79623","full_name":"Andrea Asensio Puche"},
  {"id":"88565","full_name":"Andrea Buenavida Castillo"},
  {"id":"88344","full_name":"Andrea Hernández Pérez"},
  {"id":"87943","full_name":"Andrea Landi"},
  {"id":"93351","full_name":"Andrea Zuffellato"},
  {"id":"88695","full_name":"Andreia Matias"},
  {"id":"80203","full_name":"Andreu Ibañez Salvat"},
  {"id":"72149","full_name":"Ángel Pérez González"},
  {"id":"87368","full_name":"Ángela Arjona Nieto"},
  {"id":"64429","full_name":"Ángela Huertas Sánchez"},
  {"id":"83271","full_name":"Ángela Pastor Oliva"},
  {"id":"88971","full_name":"Anna Zafeiropoulou"},
  {"id":"88269","full_name":"Annarita Lagreca"},
  {"id":"90654","full_name":"Anne-Camille Rieu"},
  {"id":"86581","full_name":"Antigoni Kourkoutaki"},
  {"id":"86035","full_name":"Apostol Trajchov"},
  {"id":"59789","full_name":"Araceli Deltell Rodríguez"},
  {"id":"86544","full_name":"Aritz Ciercoles Rina"},
  {"id":"89617","full_name":"Aurane Zanchi"},
  {"id":"93647","full_name":"Aurore Bernabeu"},
  {"id":"87203","full_name":"Aynara Meseguer"},
  {"id":"76499","full_name":"Barbara Duplouis"},
  {"id":"27523","full_name":"Begoña de las Heras de la Campa"},
  {"id":"49342","full_name":"Belén Peláez"},
  {"id":"82684","full_name":"Belén Rodenas Maya"},
  {"id":"92576","full_name":"Belén Soria Cirujeda"},
  {"id":"88273","full_name":"Borja Moreno Melián"},
  {"id":"78449","full_name":"Bruna Filipa Marques Rodrigues"},
  {"id":"87139","full_name":"Bruno Presas Calviño"},
  {"id":"92592","full_name":"Camila Santos"},
  {"id":"93854","full_name":"Camilia Abdi"},
  {"id":"88639","full_name":"Camilla Babbuini"},
  {"id":"82115","full_name":"Camille Pinardeau"},
  {"id":"87058","full_name":"Carla Fariña González"},
  {"id":"87697","full_name":"Carla Godoy Araujo"},
  {"id":"93214","full_name":"Carlos Palazón"},
  {"id":"25468","full_name":"Carlota Freschi Ballcels"},
  {"id":"82003","full_name":"Carmen Arriero Casado"},
  {"id":"92972","full_name":"Carmen Boca"},
  {"id":"78904","full_name":"Carmen Mendiguchía Garrido"},
  {"id":"95926","full_name":"Carolina Antonella Mancuso"},
  {"id":"85978","full_name":"Carolina Gomez Diaz"},
  {"id":"84239","full_name":"Carolina Monar López"},
  {"id":"94676","full_name":"Carolina Vecino Oliveira"},
  {"id":"62031","full_name":"Catalina Mirza"},
  {"id":"91541","full_name":"César Avilés Tomás"},
  {"id":"79509","full_name":"Chayma Mhamdi"},
  {"id":"88650","full_name":"Chiara Jiménez Arnoldo"},
  {"id":"87050","full_name":"Chiara Lupi"},
  {"id":"87724","full_name":"Chiara Matteucci"},
  {"id":"86612","full_name":"Christian Navero Ferreria"},
  {"id":"87309","full_name":"Christina Kemalli"},
  {"id":"92051","full_name":"Chukwuemeka David Okeke"},
  {"id":"88445","full_name":"Cintia Cosano Romero"},
  {"id":"47426","full_name":"Clara Isabel Jiménez Imbernón"},
  {"id":"93140","full_name":"Claudia Ascó Gabaldón"},
  {"id":"83074","full_name":"Clàudia Azcàrate Guitart"},
  {"id":"93678","full_name":"Claudia Bahilo Alpuente"},
  {"id":"88117","full_name":"Claudia Gómez Hoyas"},
  {"id":"69287","full_name":"Claudia Gonzalvez Casado"},
  {"id":"84297","full_name":"Claudia Sánchez Ferreira"},
  {"id":"87931","full_name":"Clement Ballester"},
  {"id":"89592","full_name":"Conrad Sampietro Teixidó"},
  {"id":"92176","full_name":"Coralie Michaud"},
  {"id":"83668","full_name":"Cristian Pérez Redondo"},
  {"id":"86380","full_name":"Cristiana Giuliano"},
  {"id":"93792","full_name":"Cristina Garde Villuendas"},
  {"id":"86536","full_name":"Dajana Zani"},
  {"id":"90600","full_name":"Dalila Simolo"},
  {"id":"88985","full_name":"Dana Andreea Floroiu"},
  {"id":"88272","full_name":"Daniel Álvarez Martín"},
  {"id":"85426","full_name":"Daniel Beneyto Juan"},
  {"id":"88700","full_name":"Daniel Miranda Villegas"},
  {"id":"86740","full_name":"Daniel Sara Ciprés"},
  {"id":"94376","full_name":"Dario Belfiore"},
  {"id":"72781","full_name":"Davide Iapadre"},
  {"id":"86522","full_name":"Davide Spinali"},
  {"id":"86677","full_name":"Debora  Vallerga"},
  {"id":"81192","full_name":"Desiree Silva Fernandez"},
  {"id":"83360","full_name":"Diana del Campo Sainz"},
  {"id":"88418","full_name":"Dumitru Francisc"},
  {"id":"78560","full_name":"Dunia Alejandra Hurtado Barrera"},
  {"id":"90068","full_name":"Edgar Lladó"},
  {"id":"91329","full_name":"Edoardo Michielon"},
  {"id":"87729","full_name":"Edurne Malmierca Rubio"},
  {"id":"87290","full_name":"Ejona Sabija"},
  {"id":"87262","full_name":"Eleanna Fountoulaki"},
  {"id":"81001","full_name":"Elena Calvo Llarandi"},
  {"id":"86584","full_name":"Elena Castellón García"},
  {"id":"84210","full_name":"Elena Nely Matanie"},
  {"id":"85758","full_name":"Elena Roldán Juan"},
  {"id":"88111","full_name":"Elena Serrano"},
  {"id":"87132","full_name":"Elisa Antoniol"},
  {"id":"86393","full_name":"Elisa Brescianini"},
  {"id":"89935","full_name":"Elisa Ruiz Zapata"},
  {"id":"88744","full_name":"Elora Riviera"},
  {"id":"87083","full_name":"Emanuela Cristallo"},
  {"id":"92948","full_name":"Emanuela Paiva"},
  {"id":"94733","full_name":"Emmanuel Iyoha"},
  {"id":"79514","full_name":"Erika García Tendero"},
  {"id":"83659","full_name":"Estel Buenaventura Bosque"},
  {"id":"86870","full_name":"Eugenio López Santiago"},
  {"id":"88406","full_name":"Eva Domínguez"},
  {"id":"94024","full_name":"Eva Ramos Martín"},
  {"id":"87311","full_name":"Facundo Agustín Herbst Salinas"},
  {"id":"83341","full_name":"Faiz Butool Javed"},
  {"id":"90112","full_name":"Fanny Poirier"},
  {"id":"74093","full_name":"Fátima del Pino López Jamile"},
  {"id":"94976","full_name":"Fiora Amour"},
  {"id":"61831","full_name":"Fiorella Maite Flores Caamaño"},
  {"id":"89326","full_name":"Flavia Parrillo"},
  {"id":"86680","full_name":"Florine Legrand"},
  {"id":"93212","full_name":"Francesca Gara"},
  {"id":"86376","full_name":"Francesco Caminati"},
  {"id":"75870","full_name":"Francesco Greco"},
  {"id":"90269","full_name":"Francesco Ture"},
  {"id":"90175","full_name":"Francisco Jiménez Bueno"},
  {"id":"87816","full_name":"Gabriel Filipe Teixeira Pereira"},
  {"id":"58973","full_name":"Gabriel Padín Henríquez"},
  {"id":"86242","full_name":"Gaia Azzurra Scivoli"},
  {"id":"81371","full_name":"Gema Alonso López"},
  {"id":"78302","full_name":"Gema Collado Guerrero"},
  {"id":"73257","full_name":"Georgia Falia"},
  {"id":"88989","full_name":"Georgia Politi"},
  {"id":"91322","full_name":"Georgina García Mouslik"},
  {"id":"69860","full_name":"Giada Mosca"},
  {"id":"89013","full_name":"Gianella Monserrath Moyano Ferreira"},
  {"id":"94207","full_name":"Gilmar Andrés Banguero Suarez"},
  {"id":"90926","full_name":"Giulia Markaryan"},
  {"id":"88002","full_name":"Gonzalo Blanco"},
  {"id":"44897","full_name":"Gressia Valladares Rohon"},
  {"id":"88314","full_name":"Guilherme Gomes de Oliviera"},
  {"id":"88606","full_name":"Gwendal Decherf"},
  {"id":"92689","full_name":"Helen Gozzo"},
  {"id":"89618","full_name":"Heloise Dautel"},
  {"id":"94190","full_name":"Hina Sajjad"},
  {"id":"76422","full_name":"Hugo Acevedo Romero"},
  {"id":"91426","full_name":"Imane Ettaalabi"},
  {"id":"94378","full_name":"Imane Ghedbane"},
  {"id":"91897","full_name":"Inés Espí García"},
  {"id":"83178","full_name":"Irene Fernández Iturralde"},
  {"id":"92635","full_name":"Isaac Pineda Sandoval"},
  {"id":"93582","full_name":"Jamila Diallo Ba Dieng"},
  {"id":"93526","full_name":"Jana Belic"},
  {"id":"95705","full_name":"Javier Martínez Beteta"},
  {"id":"63213","full_name":"Jennifer Mercado García"},
  {"id":"89371","full_name":"Jessica Chevrolet"},
  {"id":"80846","full_name":"Joan Muntané Ollé"},
  {"id":"87690","full_name":"Joana Fernandes de Freitas"},
  {"id":"87696","full_name":"Joel Cova Baute"},
  {"id":"86433","full_name":"Joel Escrivà Pardo"},
  {"id":"77838","full_name":"Joel Margalef Pulido"},
  {"id":"92277","full_name":"Jon Bedoya Montoya"},
  {"id":"83808","full_name":"Jonathan Sfredda"},
  {"id":"80393","full_name":"Josep Oriol Cubells Camps"},
  {"id":"82449","full_name":"Juan David Vélez Naranjo"},
  {"id":"81068","full_name":"Juan Manuel Fariñas Alija"},
  {"id":"88075","full_name":"Judith Aguilar Rivera"},
  {"id":"80294","full_name":"Júlia Cortés de Juncal"},
  {"id":"93558","full_name":"Julia Pascual Pérez"},
  {"id":"89743","full_name":"Julien Hug"},
  {"id":"94202","full_name":"Kamel oukil"},
  {"id":"78421","full_name":"Katerine Urbina Llontop"},
  {"id":"73730","full_name":"Konstantina Lazou"},
  {"id":"71091","full_name":"Konstantinos Stoupiadis"},
  {"id":"93661","full_name":"Konstantinos Tsampalas"},
  {"id":"88886","full_name":"Kristian Atanasov"},
  {"id":"94097","full_name":"Lambros Chalvatzis"},
  {"id":"93670","full_name":"Lara Hasan"},
  {"id":"83052","full_name":"Laura Jorba Romero"},
  {"id":"73870","full_name":"Laura Jorge González"},
  {"id":"80926","full_name":"Laura Llata González"},
  {"id":"88908","full_name":"Laura Maes Segovia"},
  {"id":"90963","full_name":"Laura Olivas Cardo"},
  {"id":"81490","full_name":"Laura Serrano Costa"},
  {"id":"94307","full_name":"Laura Vicente Llorens"},
  {"id":"80228","full_name":"Laura Vila Durán"},
  {"id":"87768","full_name":"Laurine lequeux"},
  {"id":"90213","full_name":"Lay Esi"},
  {"id":"91160","full_name":"Lea Castioni"},
  {"id":"88605","full_name":"Léa David"},
  {"id":"80693","full_name":"Leidy Johana Guañarita Bedoya"},
  {"id":"89252","full_name":"Leonor López Fernández"},
  {"id":"88894","full_name":"Leslie Cargua Arévalo"},
  {"id":"83736","full_name":"Leung Ho Wu"},
  {"id":"89613","full_name":"Liudmila Retuerto Gerónimo"},
  {"id":"84200","full_name":"Llum Serret Beser"},
  {"id":"93879","full_name":"Loredana Costache"},
  {"id":"87143","full_name":"Lorenzo Rossi"},
  {"id":"70132","full_name":"Louis Bourcier"},
  {"id":"86957","full_name":"Luca Dal Magro"},
  {"id":"83531","full_name":"Lucía Baena García"},
  {"id":"86669","full_name":"Lucía García Martínez"},
  {"id":"91687","full_name":"Lucía Soler de Jesús"},
  {"id":"85550","full_name":"Lucía Suárez González"},
  {"id":"92192","full_name":"Luigi Di Lucia"},
  {"id":"93804","full_name":"Luis Alfredo Ortega Sánchez"},
  {"id":"90811","full_name":"Maddalena Forziati"},
  {"id":"94749","full_name":"Mael Baudon"},
  {"id":"80967","full_name":"Malena Lanaspa Senosiain"},
  {"id":"93138","full_name":"Malena Torres"},
  {"id":"83116","full_name":"Manuela Betancur Salazar"},
  {"id":"87654","full_name":"Manuelmartino Mogavero"},
  {"id":"88369","full_name":"Mar Pons i Ràfols"},
  {"id":"93701","full_name":"Marc Marí García"},
  {"id":"38218","full_name":"Marcia Rosa de Assis"},
  {"id":"93576","full_name":"Marco Selvaggi"},
  {"id":"89256","full_name":"María Camila Cardona"},
  {"id":"83215","full_name":"María del Mar Marco Herrera"},
  {"id":"59989","full_name":"Maria Elena Raggi"},
  {"id":"90767","full_name":"María González Romero"},
  {"id":"88313","full_name":"Maria Kapralou"},
  {"id":"87119","full_name":"Maria Madalina Molete"},
  {"id":"79662","full_name":"María Martínez del Val"},
  {"id":"86290","full_name":"Maria Oufkir"},
  {"id":"86270","full_name":"María Pilar Miralles Argilés"},
  {"id":"86920","full_name":"María Ruiz Martínez"},
  {"id":"93366","full_name":"María Santamaría Vicente"},
  {"id":"88321","full_name":"María Verónica Reis Martins"},
  {"id":"89333","full_name":"María Victoria Muñoz"},
  {"id":"88525","full_name":"Mariana Mascarenhas Mimoso Tavares Ribeiro"},
  {"id":"88524","full_name":"Mariana Moura Ferreira"},
  {"id":"89841","full_name":"Marina Jordana Sánchez"},
  {"id":"87499","full_name":"Marta Cabrera Jonikaviciute"},
  {"id":"92736","full_name":"Marta Campillo Gutiérrez"},
  {"id":"93820","full_name":"Marta Medina López"},
  {"id":"86545","full_name":"Marta Ruiz Domingo"},
  {"id":"79973","full_name":"Mathieu Pieters"},
  {"id":"92600","full_name":"Maureen Salifu"},
  {"id":"76972","full_name":"Maurizio Rodella"},
  {"id":"95053","full_name":"Maxim Gogu"},
  {"id":"85640","full_name":"Melanie Catherine Caldeira"},
  {"id":"92831","full_name":"Melissa Jordan"},
  {"id":"87737","full_name":"Michele Longo"},
  {"id":"92844","full_name":"Michele Palomba"},
  {"id":"89787","full_name":"Michelle Giorgini"},
  {"id":"83549","full_name":"Michelle Monsalve"},
  {"id":"85752","full_name":"Miguel Ángel Fernández Sárramos"},
  {"id":"93912","full_name":"Mihaela Prodan"},
  {"id":"77275","full_name":"Miriam Aurora Gata Manzano"},
  {"id":"90961","full_name":"Myriam Ferigato"},
  {"id":"78768","full_name":"Myriam López- Villalta Labián"},
  {"id":"89048","full_name":"Nada Mouchahid"},
  {"id":"85891","full_name":"Natalia Navarro Maciá"},
  {"id":"89222","full_name":"Nelveen Tastevin"},
  {"id":"92792","full_name":"Nerea Jane García De Burgh"},
  {"id":"87626","full_name":"Niccolò Chellini"},
  {"id":"84047","full_name":"Nicole Narváez Morales"},
  {"id":"89990","full_name":"Noa Zurdo Gómez"},
  {"id":"88110","full_name":"Noelia Moral"},
  {"id":"90902","full_name":"Noemi Sáez Ramírez"},
  {"id":"61481","full_name":"Nuria Diago Sánchez"},
  {"id":"86119","full_name":"Nuria Martinez Badía"},
  {"id":"91511","full_name":"Oana Elisabeta Parfimon"},
  {"id":"93896","full_name":"Odile Blandine Heleine"},
  {"id":"88105","full_name":"Olga Huertas Gibaja"},
  {"id":"94674","full_name":"Óscar Salas Campillo"},
  {"id":"77190","full_name":"Oussaye Sabaly Balde"},
  {"id":"75600","full_name":"Oxana Foraster Montserrat"},
  {"id":"86466","full_name":"Pablo García Cabrera"},
  {"id":"92686","full_name":"Pablo García Vázquez"},
  {"id":"11167","full_name":"Pablo Gea Torres"},
  {"id":"94499","full_name":"Pablo Navarro González"},
  {"id":"62115","full_name":"Pablo Vázquez Hidalgo"},
  {"id":"82951","full_name":"Paloma López Pérez"},
  {"id":"10950","full_name":"Patricia Bravo García"},
  {"id":"91542","full_name":"Patricia Liébanas Gallego"},
  {"id":"82784","full_name":"Patricia Morillo Lamas"},
  {"id":"88102","full_name":"Paula Dominguez Arador"},
  {"id":"92589","full_name":"Persefoni Konstantina Kapourtidi"},
  {"id":"89457","full_name":"Pilar Tornos"},
  {"id":"92002","full_name":"Raffaele Russo"},
  {"id":"93177","full_name":"Raquel de la Cruz"},
  {"id":"95103","full_name":"Raúl Martínez Sánchez"},
  {"id":"84068","full_name":"Raúl Satorres Luna"},
  {"id":"93898","full_name":"Rebecca Ringressi"},
  {"id":"86313","full_name":"Riccardo Spiga"},
  {"id":"86273","full_name":"Robert Pop"},
  {"id":"88891","full_name":"Rocío Valiente Nuñez"},
  {"id":"72117","full_name":"Roger Amado Campo"},
  {"id":"86895","full_name":"Romane Blanc"},
  {"id":"86379","full_name":"Rosanna Siliberti"},
  {"id":"89377","full_name":"Ryan Jeffrey Surria"},
  {"id":"94748","full_name":"Sacha Glory"},
  {"id":"84481","full_name":"Salvador Picossi Trescastro"},
  {"id":"89290","full_name":"Samuel Caballero Suárez"},
  {"id":"92001","full_name":"Sarah Hajar-Bouzid"},
  {"id":"89220","full_name":"Sebastien Dupin"},
  {"id":"89887","full_name":"Sergio Sánchez Guerrero"},
  {"id":"94293","full_name":"Sharon Muratore"},
  {"id":"92235","full_name":"Silvia Guerra"},
  {"id":"87945","full_name":"Silvia Turrina"},
  {"id":"85745","full_name":"Silvio Pagliaro"},
  {"id":"87723","full_name":"Simona Buffo"},
  {"id":"86707","full_name":"Simona Candellori"},
  {"id":"88172","full_name":"Simona Carbellotti"},
  {"id":"85655","full_name":"Simone Gulizia"},
  {"id":"58190","full_name":"Simone Quaresmini"},
  {"id":"88972","full_name":"Sindy Leiny Burga Males"},
  {"id":"89984","full_name":"Sonia Pastor Aguado"},
  {"id":"75781","full_name":"Stavroula Makri"},
  {"id":"86063","full_name":"Susana Izquierdo Negro"},
  {"id":"86497","full_name":"Susana Monayong"},
  {"id":"92621","full_name":"Tatiana Potier"},
  {"id":"50573","full_name":"Tatyana Arkaeva Arkaeva"},
  {"id":"87620","full_name":"Teresa Ferri"},
  {"id":"88276","full_name":"Tetyana Babyuk"},
  {"id":"89619","full_name":"Thomas Bivi"},
  {"id":"86817","full_name":"Thomas Tzilopoulos"},
  {"id":"93540","full_name":"Timothy Sanson"},
  {"id":"94649","full_name":"Tiziana Bisso"},
  {"id":"91425","full_name":"Toader Costel Ghinghiloschi"},
  {"id":"89643","full_name":"Tom Canpinchi"},
  {"id":"92531","full_name":"Touiker Mounir"},
  {"id":"88219","full_name":"Valentina de Freitas Castillo"},
  {"id":"88535","full_name":"Valentina Sepich"},
  {"id":"82624","full_name":"Valentina Tinoco Francés"},
  {"id":"86201","full_name":"Victoria Souviron Dixon"},
  {"id":"91981","full_name":"Vincenzo Ricciardi"},
  {"id":"88249","full_name":"Yamina thaibaoui"},
  {"id":"92919","full_name":"Yannis Colin"},
  {"id":"86909","full_name":"Yashira Coello Ventura"},
  {"id":"90712","full_name":"Zafeiria Chatzipalamoutzi"},
  {"id":"91620","full_name":"Zoi Karapetrou"},
]

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')         // collapse whitespace
    .replace(/\(.*?\)/g, '')      // strip (nickname) parentheses
    .replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation (keep letters/numbers/spaces)
    .trim()
    .replace(/\s+/g, ' ')
}

// Build lookup: normalized_name → db_id
const NAME_TO_ID = new Map<string, string>()
for (const c of DB_CANDIDATES) {
  NAME_TO_ID.set(normalize(c.full_name), c.id)
}

async function getZohoToken(): Promise<string> {
  const { ZOHO_TOKEN_URL, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN } = process.env
  const res = await fetch(ZOHO_TOKEN_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CLIENT_ID!,
      client_secret: ZOHO_CLIENT_SECRET!,
      refresh_token: ZOHO_REFRESH_TOKEN!,
    }).toString(),
  })
  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error(`No token: ${JSON.stringify(data)}`)
  return data.access_token
}

async function main() {
  console.error('🔑 Getting Zoho token...')
  const token = await getZohoToken()
  console.error('✓ Token OK')

  const base = (process.env.ZOHO_API_BASE_URL ?? '').replace(/\/$/, '')

  // Paginate ALL Zoho candidates with minimal fields
  const results: { id: string; tags: string[] }[] = []
  let page = 1
  let hasMore = true
  let totalFetched = 0
  let matched = 0

  console.error('📥 Paginating Zoho candidates (Full_Name + Associated_Tags only)...')

  while (hasMore) {
    const url = new URL(`${base}/Candidates`)
    url.searchParams.set('fields', 'Full_Name,Associated_Tags')
    url.searchParams.set('per_page', '200')
    url.searchParams.set('page', String(page))

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })

    if (res.status === 204) {
      console.error(`  Page ${page}: no more records`)
      break
    }
    if (!res.ok) {
      console.error(`  Page ${page}: HTTP ${res.status} ${await res.text()}`)
      break
    }

    const body = await res.json() as {
      data?: Record<string, unknown>[]
      info?: { more_records?: boolean; count?: number }
    }

    const records = body.data ?? []
    totalFetched += records.length
    hasMore = body.info?.more_records ?? false

    for (const r of records) {
      const name = String(r.Full_Name ?? '')
      const norm = normalize(name)
      const dbId = NAME_TO_ID.get(norm)

      if (dbId) {
        const rawTags = r.Associated_Tags as Array<string | { name: string }> | null | undefined
        const tags = (rawTags ?? [])
          .map(t => (typeof t === 'string' ? t : (t as { name: string }).name ?? ''))
          .filter(Boolean)
        if (tags.length > 0) {
          results.push({ id: dbId, tags })
        }
        matched++
      }
    }

    console.error(`  Page ${page}: ${records.length} fetched, ${matched} matched DB so far, ${results.length} with tags`)

    page++
    if (hasMore) await new Promise(r => setTimeout(r, 200))
  }

  console.error(`\n✅ Done: ${totalFetched} Zoho candidates fetched`)
  console.error(`   Matched to DB: ${matched}/${DB_CANDIDATES.length}`)
  console.error(`   With tags: ${results.length}`)
  console.log(JSON.stringify(results))
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
