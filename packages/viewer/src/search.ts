/**
 * search.ts — Search JavaScript inlined into the viewer HTML.
 *
 * Filters tree nodes by label or content.
 * Debounced 200ms. Pure vanilla JS — no framework.
 */

/** Returns an inline <script> block for search functionality. */
export function searchScript(): string {
  return `<script>
(function(){
  var inp = document.getElementById('vw-search');
  var noRes = document.getElementById('vw-no-results');
  if(!inp) return;
  var timer;

  function getAncestors(el){
    var parents = [];
    var cur = el.parentElement;
    while(cur){
      parents.push(cur);
      cur = cur.parentElement;
    }
    return parents;
  }

  function showAncestors(el){
    getAncestors(el).forEach(function(p){
      if(p.tagName === 'DETAILS') p.open = true;
      if(p.style) p.style.display = '';
      if(p.classList && p.classList.contains('vw-node')) p.style.display = '';
      if(p.classList && p.classList.contains('vw-branch')) p.style.display = '';
    });
  }

  function doFilter(q){
    var nodes = document.querySelectorAll('.vw-node');
    var branches = document.querySelectorAll('.vw-branch');
    var matched = 0;

    if(!q){
      nodes.forEach(function(n){ n.style.display = ''; });
      branches.forEach(function(b){ b.style.display = ''; });
      if(noRes) noRes.style.display = 'none';
      return;
    }

    var lq = q.toLowerCase();

    // First pass: hide all nodes
    nodes.forEach(function(n){ n.style.display = 'none'; });
    branches.forEach(function(b){ b.style.display = 'none'; });

    // Second pass: show matching nodes + their ancestors
    nodes.forEach(function(n){
      var label = (n.getAttribute('data-label') || '').toLowerCase();
      var content = (n.getAttribute('data-content') || '').toLowerCase();
      if(label.indexOf(lq) !== -1 || content.indexOf(lq) !== -1){
        n.style.display = '';
        showAncestors(n);
        matched++;
      }
    });

    if(noRes) noRes.style.display = matched === 0 ? 'block' : 'none';
  }

  inp.addEventListener('input', function(){
    clearTimeout(timer);
    var val = inp.value.trim();
    timer = setTimeout(function(){ doFilter(val); }, 200);
  });
})();
</script>`;
}
