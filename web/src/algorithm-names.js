export const algorithmNames={
 GA:{english:'Genetic Algorithm',zh:'遗传算法',it:'Algoritmo genetico'},
 PSO:{english:'Particle Swarm Optimization',zh:'粒子群优化算法',it:'Ottimizzazione a sciame di particelle'},
 SA:{english:'Simulated Annealing',zh:'模拟退火算法',it:'Ricottura simulata'}
};
export function algorithmLabel(language,code){const n=algorithmNames[code];if(!n)throw Error('Unknown algorithm: '+code);return `${code} · ${n.english}`+(language==='zh'?`（${n.zh}）`:language==='it'?` — ${n.it}`:'');}
