import type { Blueprint, Region } from './template-layouts.ts';
type Box = [number,number,number,number];
type Signature = [string,string,string,Box[],Box[],Box];
const region=([x,y,w,h]:Box):Region=>({x,y,w,h});
/** Authored interior compositions: coordinates are shared by samples, prompts and exported books. */
const signatures:Signature[]=[
 ['manifesto','Bold opening','A strong left reading column faces a small isolated ink object on a spacious right page.',[[65,26,24,43]],[[7,10,36,49]],[7,69,36,23]],
 ['wild','Specimen and field notes','A tall botanical specimen dominates the left; two short field-note areas sit on the right.',[[5,5,48,88]],[[62,12,30,43]],[62,65,30,26]],
 ['fragments','Collected fragments','Three unequal archival fragments form a left collage; prose and annotation align on the right.',[[5,8,24,36],[31,19,17,27],[13,51,31,38]],[[58,9,34,45]],[58,65,34,27]],
 ['chromatic','Sculptural colour opening','Two broad interlocking colour fields introduce a compact reading page with a low reflection.',[[0,0,30,68],[22,35,28,65]],[[59,14,32,42]],[59,72,32,20]],
 ['echo','Poem and marginal mark','Centered verse occupies the broad left page; a small vertical ink mark answers it on the far right.',[[84,18,9,51]],[[13,11,54,45]],[22,68,40,23]],
 ['haze','Two quiet reading islands','Two short reading islands float above a low atmospheric wash, with expansive empty paper.',[[8,73,84,20]],[[12,18,33,42]],[59,25,28,33]],
 ['little-explorers','Woodland clearing','An expansive woodland scene wraps a tall quiet reading clearing on the left.',[[49,0,51,100],[0,0,43,9],[0,91,43,9]],[[7,17,33,41]],[7,68,33,17]],
 ['bedtime-skies','Ocean and white story band','A deep panoramic discovery scene spans the top; a compact two-part white reading band sits below.',[[0,0,100,62]],[[7,68,42,26]],[58,68,35,26]],
 ['paper-play','Fairy tale and framed page','A full-height left fairy-tale plate faces a delicately framed right reading page.',[[3,3,46,94]],[[59,15,31,43]],[59,69,31,21]],
 ['flower-festival','Family vignette and flower detail','A broad soft family vignette sits at lower left, with a small floral detail above the right reading area.',[[4,30,46,63],[69,4,20,20]],[[57,31,36,34]],[57,75,36,18]],
 ['snowy-friends','Distant snowy horizon','A shallow, quiet landscape leaves a broad white band with two centered reading islands.',[[0,3,100,48]],[[13,60,34,31]],[59,64,29,25]],
 ['bedtime-play','Playful room and inset','A lively room scene surrounds a compact upper-left paper inset, with a separate lower reflection.',[[45,0,55,100],[0,78,41,22]],[[6,10,33,39]],[6,57,33,16]],
 ['treehouse-days','Nature notebook moments','Three small nature sketches step down the left; spacious story text stays on the right.',[[7,7,25,22],[18,37,28,23],[5,72,28,22]],[[57,12,35,42]],[57,66,35,23]],
 ['colourful-journey','Collage journey','A large right collage and a narrow low-left accent face an uncluttered cream reading page.',[[52,4,45,91],[6,79,33,14]],[[7,10,34,35]],[7,53,34,20]],
 ['painted-memories','Dream painting and short lines','A softly edged left painting faces short lines set high on a wide quiet page.',[[4,13,45,74]],[[63,13,27,36]],[63,64,27,24]],
 ['painted','Expansive devotional plate','A generous right painting balances a tall verse column and a modest lower explanation.',[[47,5,50,90]],[[5,12,34,43]],[5,68,34,23]],
 ['heritage','Miniature folio','A carefully inset framed miniature faces a balanced reading page with large outer margins.',[[58,12,32,75]],[[10,15,35,39]],[10,64,35,24]],
 ['quiet','Small contemplative encounter','Two tiny quiet vignettes frame an airy upper-right passage and a low left reflection.',[[9,14,24,29],[76,77,16,16]],[[47,12,44,42]],[10,65,47,25]],
 ['moonlit','Moonlit plate and verses','A small luminous framed nocturne rests above centered silver-toned verses.',[[35,5,30,27]],[[19,39,62,31]],[25,79,50,16]],
 ['botanical','Botanical notebook margin','A tall leaf study and small oval nature detail accompany an open reading column.',[[4,4,17,89],[69,66,23,27]],[[30,12,60,36]],[30,60,31,30]],
 ['vermilion','Graphic ink and red rules','Two graphic ink blocks form a right-hand stack; strong left-aligned verse fills the reading page.',[[59,7,34,35],[68,53,25,37]],[[7,9,37,43]],[7,65,37,25]],
 ['storybook','Friendly picture window','A rounded picture window sits upper left; the story flows on the right with reflection beneath the window.',[[5,8,42,52]],[[57,15,35,62]],[8,72,36,20]],
 ['archive','Two captioned plates','Two small archive plates occupy the upper margin; source text and commentary form separate columns below.',[[8,7,26,25],[43,9,23,23]],[[8,43,41,48]],[61,43,31,48]],
 ['festival','Decorative bands and central painting','A vivid center-right painting and thin decorative bands frame a left verse column.',[[50,14,44,70],[4,3,92,6],[4,91,92,6]],[[7,17,34,35]],[7,63,34,21]],
 ['panorama','Wide painting with reading shelf','A full-width panoramic painting occupies the upper half; generous source and meaning columns sit beneath.',[[0,0,100,53]],[[6,61,43,31]],[59,61,35,31]],
 ['immersive','Painting around paper','A full-height right scene flows above and below a left paper reading inset.',[[46,0,54,100],[0,0,42,12],[0,89,42,11]],[[8,20,30,36]],[8,65,30,16]],
 ['poetry','Verse and closing seal','Broad centered verses lead the page, followed by explanation and a tiny closing illustration.',[[42,82,16,14]],[[18,8,64,40]],[25,57,50,18]],
 ['study','Study strip and commentary','A shallow illustration strip introduces two clearly separated scholarly reading columns.',[[5,4,90,24]],[[7,36,40,57]],[59,36,34,57]],
];
export const signatureBlueprints:Record<string,Blueprint[]> = Object.fromEntries(signatures.map(([id,name,intent,art,original,meaning])=>{
 const first:Blueprint={id:`${id}-signature`,name,intent,art:art.map(region),original:original.map(region),meaning:region(meaning),...(['little-explorers','bedtime-play','immersive'].includes(id)?{integrated:true,panel:true}:{})};
 const mirror=(a:Region):Region=>({...a,x:100-a.x-a.w});
 const second:Blueprint={...first,id:`${id}-response`,name:`${name} · facing arrangement`,intent:`A facing-page variation of ${name.toLowerCase()}: reverse the illustration and reading positions while preserving its proportions and visual character.`,art:first.art.map(mirror),original:first.original.map(mirror),meaning:mirror(first.meaning)};
 return [id,[first,second]];
}));
