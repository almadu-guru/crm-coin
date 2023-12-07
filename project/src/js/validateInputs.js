function updateInputValidation(input, validated) {
  if (!validated) {
    input.classList.add('invalidated');
  } else {
    input.classList.remove('invalidated');
  }
}

function validateAccount(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return null;

  const accountValue = input.value.trim();
  console.log(accountValue);

  // валидация
  let validated = true;
  if (!Number.isInteger(accountValue)) validated = false;

  // обработка инпута
  updateInputValidation(input, validated);

  return validated;
}

export { validateAccount };
