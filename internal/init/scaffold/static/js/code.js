function copyCode(btn) {
    var code = btn.closest('.code-block').querySelector('code').textContent;
    var textSpan = btn.querySelector('.copy-text');
    navigator.clipboard.writeText(code).then(function () {
        textSpan.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
            textSpan.textContent = 'Copy';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(function () {
        textSpan.textContent = 'Failed';
        setTimeout(function () {
            textSpan.textContent = 'Copy';
        }, 1500);
    });
}
