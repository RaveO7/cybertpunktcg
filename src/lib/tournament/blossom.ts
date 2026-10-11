// Couplage de poids maximal dans un graphe général (algorithme d'Edmonds, « blossom »), en
// O(n³). Port fidèle de mwmatching.py (Joris van Rantwijk, domaine public), la version dont
// dérive networkx.max_weight_matching. Poids entiers uniquement : tous les calculs restent exacts.
//
// Utilisé pour les appariements suisses : chaque paire de joueurs est une arête dont le poids
// favorise « pas de revanche » puis « même nombre de points » (cf. pairing.ts).

/** Arête [sommet, sommet, poids entier]. */
export type WeightedEdge = readonly [number, number, number];

/** Index Python : un indice négatif part de la fin du tableau. */
function at<T>(items: T[], index: number): T {
  return items[index < 0 ? index + items.length : index];
}

/**
 * Retourne `mate` : mate[v] = sommet apparié à v, ou -1.
 * `maxCardinality` : parmi les couplages de cardinalité maximale, prendre le plus lourd.
 */
export function maxWeightMatching(edges: readonly WeightedEdge[], maxCardinality = false): number[] {
  if (edges.length === 0) return [];
  for (const [, , weight] of edges) {
    if (!Number.isSafeInteger(weight)) throw new Error("Poids entier requis.");
  }

  const nedge = edges.length;
  let nvertex = 0;
  for (const [i, j] of edges) {
    if (i < 0 || j < 0 || i === j) throw new Error("Arête invalide.");
    nvertex = Math.max(nvertex, i + 1, j + 1);
  }
  const maxweight = Math.max(0, ...edges.map((edge) => edge[2]));

  // endpoint[p] : sommet de l'extrémité p ; l'arête k a les extrémités 2k et 2k+1.
  const endpoint: number[] = [];
  for (let p = 0; p < 2 * nedge; p += 1) endpoint.push(edges[Math.floor(p / 2)][p % 2]);
  const neighbend: number[][] = Array.from({ length: nvertex }, () => []);
  edges.forEach(([i, j], k) => {
    neighbend[i].push(2 * k + 1);
    neighbend[j].push(2 * k);
  });

  const mate: number[] = new Array(nvertex).fill(-1);
  const label: number[] = new Array(2 * nvertex).fill(0);
  const labelend: number[] = new Array(2 * nvertex).fill(-1);
  const inblossom: number[] = Array.from({ length: nvertex }, (_, v) => v);
  const blossomparent: number[] = new Array(2 * nvertex).fill(-1);
  const blossomchilds: (number[] | null)[] = new Array(2 * nvertex).fill(null);
  const blossombase: number[] = [...Array.from({ length: nvertex }, (_, v) => v), ...new Array(nvertex).fill(-1)];
  const blossomendps: (number[] | null)[] = new Array(2 * nvertex).fill(null);
  const bestedge: number[] = new Array(2 * nvertex).fill(-1);
  const blossombestedges: (number[] | null)[] = new Array(2 * nvertex).fill(null);
  const unusedblossoms: number[] = Array.from({ length: nvertex }, (_, i) => nvertex + i);
  const dualvar: number[] = [...new Array(nvertex).fill(maxweight), ...new Array(nvertex).fill(0)];
  const allowedge: boolean[] = new Array(nedge).fill(false);
  let queue: number[] = [];

  const slack = (k: number) => {
    const [i, j, weight] = edges[k];
    return dualvar[i] + dualvar[j] - 2 * weight;
  };

  const blossomLeaves = (b: number): number[] => {
    if (b < nvertex) return [b];
    const leaves: number[] = [];
    for (const t of blossomchilds[b]!) {
      if (t < nvertex) leaves.push(t);
      else leaves.push(...blossomLeaves(t));
    }
    return leaves;
  };

  // Étiquette t (1 = S, 2 = T) au sommet w et à sa fleur, atteint par l'extrémité p.
  const assignLabel = (w: number, t: number, p: number): void => {
    const b = inblossom[w];
    label[w] = label[b] = t;
    labelend[w] = labelend[b] = p;
    bestedge[w] = bestedge[b] = -1;
    if (t === 1) {
      queue.push(...blossomLeaves(b));
    } else if (t === 2) {
      const base = blossombase[b];
      assignLabel(endpoint[mate[base]], 1, mate[base] ^ 1);
    }
  };

  // Remonte les chemins alternés depuis v et w : base de la nouvelle fleur, ou -1 (chemin augmentant).
  const scanBlossom = (vStart: number, wStart: number) => {
    const path: number[] = [];
    let base = -1;
    let v = vStart;
    let w = wStart;
    while (v !== -1 || w !== -1) {
      let b = inblossom[v];
      if (label[b] & 4) {
        base = blossombase[b];
        break;
      }
      path.push(b);
      label[b] = 5;
      if (labelend[b] === -1) {
        v = -1;
      } else {
        v = endpoint[labelend[b]];
        b = inblossom[v];
        v = endpoint[labelend[b]];
      }
      if (w !== -1) [v, w] = [w, v];
    }
    for (const b of path) label[b] = 1;
    return base;
  };

  const addBlossom = (base: number, k: number) => {
    let [v, w] = edges[k];
    const bb = inblossom[base];
    let bv = inblossom[v];
    let bw = inblossom[w];
    const b = unusedblossoms.pop()!;
    blossombase[b] = base;
    blossomparent[b] = -1;
    blossomparent[bb] = b;
    const path: number[] = [];
    const endps: number[] = [];
    blossomchilds[b] = path;
    blossomendps[b] = endps;
    while (bv !== bb) {
      blossomparent[bv] = b;
      path.push(bv);
      endps.push(labelend[bv]);
      v = endpoint[labelend[bv]];
      bv = inblossom[v];
    }
    path.push(bb);
    path.reverse();
    endps.reverse();
    endps.push(2 * k);
    while (bw !== bb) {
      blossomparent[bw] = b;
      path.push(bw);
      endps.push(labelend[bw] ^ 1);
      w = endpoint[labelend[bw]];
      bw = inblossom[w];
    }
    label[b] = 1;
    labelend[b] = labelend[bb];
    dualvar[b] = 0;
    for (const leaf of blossomLeaves(b)) {
      if (label[inblossom[leaf]] === 2) queue.push(leaf);
      inblossom[leaf] = b;
    }
    const bestedgeto: number[] = new Array(2 * nvertex).fill(-1);
    for (const child of path) {
      const nblists =
        blossombestedges[child] === null
          ? blossomLeaves(child).map((leaf) => neighbend[leaf].map((p) => Math.floor(p / 2)))
          : [blossombestedges[child]!];
      for (const nblist of nblists) {
        for (const edge of nblist) {
          let [i, j] = edges[edge];
          if (inblossom[j] === b) [i, j] = [j, i];
          const bj = inblossom[j];
          if (bj !== b && label[bj] === 1 && (bestedgeto[bj] === -1 || slack(edge) < slack(bestedgeto[bj]))) {
            bestedgeto[bj] = edge;
          }
        }
      }
      blossombestedges[child] = null;
      bestedge[child] = -1;
    }
    blossombestedges[b] = bestedgeto.filter((edge) => edge !== -1);
    bestedge[b] = -1;
    for (const edge of blossombestedges[b]!) {
      if (bestedge[b] === -1 || slack(edge) < slack(bestedge[b])) bestedge[b] = edge;
    }
  };

  const expandBlossom = (b: number, endstage: boolean): void => {
    const childs = blossomchilds[b]!;
    for (const s of childs) {
      blossomparent[s] = -1;
      if (s < nvertex) inblossom[s] = s;
      else if (endstage && dualvar[s] === 0) expandBlossom(s, endstage);
      else for (const leaf of blossomLeaves(s)) inblossom[leaf] = s;
    }
    if (!endstage && label[b] === 2) {
      const endps = blossomendps[b]!;
      const entrychild = inblossom[endpoint[labelend[b] ^ 1]];
      let j = childs.indexOf(entrychild);
      let jstep: number;
      let endptrick: number;
      if (j & 1) {
        j -= childs.length;
        jstep = 1;
        endptrick = 0;
      } else {
        jstep = -1;
        endptrick = 1;
      }
      let p = labelend[b];
      while (j !== 0) {
        label[endpoint[p ^ 1]] = 0;
        label[endpoint[at(endps, j - endptrick) ^ endptrick ^ 1]] = 0;
        assignLabel(endpoint[p ^ 1], 2, p);
        allowedge[Math.floor(at(endps, j - endptrick) / 2)] = true;
        j += jstep;
        p = at(endps, j - endptrick) ^ endptrick;
        allowedge[Math.floor(p / 2)] = true;
        j += jstep;
      }
      let bv = at(childs, j);
      label[endpoint[p ^ 1]] = label[bv] = 2;
      labelend[endpoint[p ^ 1]] = labelend[bv] = p;
      bestedge[bv] = -1;
      j += jstep;
      while (at(childs, j) !== entrychild) {
        bv = at(childs, j);
        if (label[bv] === 1) {
          j += jstep;
          continue;
        }
        let found = -1;
        for (const leaf of blossomLeaves(bv)) {
          if (label[leaf] !== 0) {
            found = leaf;
            break;
          }
        }
        if (found !== -1) {
          label[found] = 0;
          label[endpoint[mate[blossombase[bv]]]] = 0;
          assignLabel(found, 2, labelend[found]);
        }
        j += jstep;
      }
    }
    label[b] = labelend[b] = -1;
    blossomchilds[b] = blossomendps[b] = null;
    blossombase[b] = -1;
    blossombestedges[b] = null;
    bestedge[b] = -1;
    unusedblossoms.push(b);
  };

  const augmentBlossom = (b: number, v: number): void => {
    let t = v;
    while (blossomparent[t] !== b) t = blossomparent[t];
    if (t >= nvertex) augmentBlossom(t, v);
    const childs = blossomchilds[b]!;
    const endps = blossomendps[b]!;
    const i = childs.indexOf(t);
    let j = i;
    let jstep: number;
    let endptrick: number;
    if (i & 1) {
      j -= childs.length;
      jstep = 1;
      endptrick = 0;
    } else {
      jstep = -1;
      endptrick = 1;
    }
    while (j !== 0) {
      j += jstep;
      t = at(childs, j);
      const p = at(endps, j - endptrick) ^ endptrick;
      if (t >= nvertex) augmentBlossom(t, endpoint[p]);
      j += jstep;
      t = at(childs, j);
      if (t >= nvertex) augmentBlossom(t, endpoint[p ^ 1]);
      mate[endpoint[p]] = p ^ 1;
      mate[endpoint[p ^ 1]] = p;
    }
    blossomchilds[b] = [...childs.slice(i), ...childs.slice(0, i)];
    blossomendps[b] = [...endps.slice(i), ...endps.slice(0, i)];
    blossombase[b] = blossombase[blossomchilds[b]![0]];
  };

  const augmentMatching = (k: number) => {
    const [v, w] = edges[k];
    for (const [start, startP] of [
      [v, 2 * k + 1],
      [w, 2 * k],
    ]) {
      let s = start;
      let p = startP;
      for (;;) {
        const bs = inblossom[s];
        if (bs >= nvertex) augmentBlossom(bs, s);
        mate[s] = p;
        if (labelend[bs] === -1) break;
        const t = endpoint[labelend[bs]];
        const bt = inblossom[t];
        s = endpoint[labelend[bt]];
        const j = endpoint[labelend[bt] ^ 1];
        if (bt >= nvertex) augmentBlossom(bt, j);
        mate[j] = labelend[bt];
        p = labelend[bt] ^ 1;
      }
    }
  };

  for (let stage = 0; stage < nvertex; stage += 1) {
    label.fill(0);
    bestedge.fill(-1);
    for (let b = nvertex; b < 2 * nvertex; b += 1) blossombestedges[b] = null;
    allowedge.fill(false);
    queue = [];
    for (let v = 0; v < nvertex; v += 1) {
      if (mate[v] === -1 && label[inblossom[v]] === 0) assignLabel(v, 1, -1);
    }

    let augmented = false;
    for (;;) {
      while (queue.length > 0 && !augmented) {
        const v = queue.pop()!;
        for (const p of neighbend[v]) {
          const k = Math.floor(p / 2);
          const w = endpoint[p];
          if (inblossom[v] === inblossom[w]) continue;
          let kslack = 0;
          if (!allowedge[k]) {
            kslack = slack(k);
            if (kslack <= 0) allowedge[k] = true;
          }
          if (allowedge[k]) {
            if (label[inblossom[w]] === 0) {
              assignLabel(w, 2, p ^ 1);
            } else if (label[inblossom[w]] === 1) {
              const base = scanBlossom(v, w);
              if (base >= 0) {
                addBlossom(base, k);
              } else {
                augmentMatching(k);
                augmented = true;
                break;
              }
            } else if (label[w] === 0) {
              label[w] = 2;
              labelend[w] = p ^ 1;
            }
          } else if (label[inblossom[w]] === 1) {
            const b = inblossom[v];
            if (bestedge[b] === -1 || kslack < slack(bestedge[b])) bestedge[b] = k;
          } else if (label[w] === 0) {
            if (bestedge[w] === -1 || kslack < slack(bestedge[w])) bestedge[w] = k;
          }
        }
      }
      if (augmented) break;

      // Pas de chemin augmentant : on ajuste les variables duales.
      let deltatype = -1;
      let delta = 0;
      let deltaedge = -1;
      let deltablossom = -1;
      if (!maxCardinality) {
        deltatype = 1;
        delta = Math.min(...dualvar.slice(0, nvertex));
      }
      for (let v = 0; v < nvertex; v += 1) {
        if (label[inblossom[v]] === 0 && bestedge[v] !== -1) {
          const d = slack(bestedge[v]);
          if (deltatype === -1 || d < delta) {
            delta = d;
            deltatype = 2;
            deltaedge = bestedge[v];
          }
        }
      }
      for (let b = 0; b < 2 * nvertex; b += 1) {
        if (blossomparent[b] === -1 && label[b] === 1 && bestedge[b] !== -1) {
          const d = Math.floor(slack(bestedge[b]) / 2);
          if (deltatype === -1 || d < delta) {
            delta = d;
            deltatype = 3;
            deltaedge = bestedge[b];
          }
        }
      }
      for (let b = nvertex; b < 2 * nvertex; b += 1) {
        if (
          blossombase[b] >= 0 &&
          blossomparent[b] === -1 &&
          label[b] === 2 &&
          (deltatype === -1 || dualvar[b] < delta)
        ) {
          delta = dualvar[b];
          deltatype = 4;
          deltablossom = b;
        }
      }
      if (deltatype === -1) {
        deltatype = 1;
        delta = Math.max(0, Math.min(...dualvar.slice(0, nvertex)));
      }

      for (let v = 0; v < nvertex; v += 1) {
        if (label[inblossom[v]] === 1) dualvar[v] -= delta;
        else if (label[inblossom[v]] === 2) dualvar[v] += delta;
      }
      for (let b = nvertex; b < 2 * nvertex; b += 1) {
        if (blossombase[b] >= 0 && blossomparent[b] === -1) {
          if (label[b] === 1) dualvar[b] += delta;
          else if (label[b] === 2) dualvar[b] -= delta;
        }
      }

      if (deltatype === 1) break;
      if (deltatype === 2) {
        allowedge[deltaedge] = true;
        let [i, j] = edges[deltaedge];
        if (label[inblossom[i]] === 0) [i, j] = [j, i];
        void j;
        queue.push(i);
      } else if (deltatype === 3) {
        allowedge[deltaedge] = true;
        queue.push(edges[deltaedge][0]);
      } else if (deltatype === 4) {
        expandBlossom(deltablossom, false);
      }
    }

    if (!augmented) break;

    for (let b = nvertex; b < 2 * nvertex; b += 1) {
      if (blossomparent[b] === -1 && blossombase[b] >= 0 && label[b] === 1 && dualvar[b] === 0) {
        expandBlossom(b, true);
      }
    }
  }

  return mate.map((p) => (p >= 0 ? endpoint[p] : -1));
}
