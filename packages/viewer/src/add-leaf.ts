/**
 * add-leaf.ts — "Add Leaf" inline form JavaScript.
 *
 * Each node has an "Add Leaf" button that, when clicked, reveals
 * an inline input. On submit it shows the DOT-language equivalent
 * of the new leaf observation.
 *
 * No server round-trip in this version — output is shown inline.
 */

/** Returns an inline <script> block for the add-leaf form. */
export function addLeafScript(): string {
  return `<script>
(function(){
  document.addEventListener('click', function(e){
    var btn = e.target;

    // Add Leaf button click
    if(btn.classList && btn.classList.contains('vw-add-leaf-btn')){
      var nodeId = btn.getAttribute('data-node-id');
      var form = document.getElementById('vw-form-' + nodeId);
      if(!form) return;
      var isOpen = form.classList.contains('vw-open');
      form.classList.toggle('vw-open', !isOpen);
      if(!isOpen){
        var input = form.querySelector('.vw-add-leaf-input');
        if(input) input.focus();
      }
      return;
    }

    // Submit button click
    if(btn.classList && btn.classList.contains('vw-add-leaf-submit')){
      var form = btn.closest('.vw-add-leaf-form');
      if(!form) return;
      var input = form.querySelector('.vw-add-leaf-input');
      var output = form.querySelector('.vw-add-leaf-output');
      if(!input || !output) return;
      var content = input.value.trim();
      if(!content) return;
      var parentHash = form.getAttribute('data-parent-hash') || 'unknown';
      var dotSource = 'observe claim: "' + content.replace(/"/g, '\\"') + '"\n  .chain(previous: ' + parentHash + ')';
      output.textContent = dotSource;
      output.style.display = 'block';
      input.value = '';
      return;
    }

    // Cancel: click outside form closes it
  });

  // Enter key in input triggers submit
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter') return;
    var input = e.target;
    if(!input.classList || !input.classList.contains('vw-add-leaf-input')) return;
    var form = input.closest('.vw-add-leaf-form');
    if(!form) return;
    var btn = form.querySelector('.vw-add-leaf-submit');
    if(btn) btn.click();
  });
})();
</script>`;
}
