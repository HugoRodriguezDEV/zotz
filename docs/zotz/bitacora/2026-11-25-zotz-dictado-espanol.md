# Dictado en español para usuarios bilingües (`zotz-dictado-espanol`)

2026-11-25

- **Problema:** con macOS en `en-MX` + `es-MX` y el idioma del dictado en Auto, la configuración de un clic tomaba solo el primer idioma y elegía Parakeet Unified EN (solo inglés). Dictar en español salía como "Necessitamos are a form of Nictara in Espaol…".
- **Sugerencia de modelo:** ahora cubre todos los idiomas que habla el usuario (idioma del dictado; con Auto, el idioma de la interfaz elegido y todos los idiomas preferidos del sistema). Entre los modelos que los cubren gana el de menor error en el peor idioma; con en + es es **Parakeet TDT v3** (en 3.7 %, es 1.7 %). `UiLanguageDetection` lleva `preferredTags` con la lista completa.
- **Perfiles guardados:** una vez por perfil (`zotzDictationLanguagesChecked`), si el modelo elegido no oye uno de esos idiomas, Zotz baja el sugerido en segundo plano y cambia al terminar (el dictado nunca se queda sin modelo); avisa con un toast. Si el usuario cambió de modelo mientras bajaba, se respeta el suyo. Modelos en la nube y dictado apagado no se tocan; el cliente web emparejado no corre la revisión.
- Verificado en una instancia dev con el modelo solo-inglés: la migración bajó Parakeet TDT v3 y cambió; el mismo audio en español (voz Eddy es-MX) pasó de "Necessitamos are a form of Nictara in Espaol…" a "Necesitamos agregar una forma de dictar en español. Si estoy hablando en español, la transcripción tiene que salir en español, con acentos y puntuación."; inglés sigue exacto.
