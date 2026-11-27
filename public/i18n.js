/* Astra Player - interface language. Looks up the English text of labels and swaps it for the chosen language.
   Anything without a translation stays in English. Order: hi, es, fr, pt, de, id */
(function () {
  const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['es', 'Español'], ['fr', 'Français'], ['pt', 'Português'], ['de', 'Deutsch'], ['id', 'Bahasa Indonesia']];
  const ROWS = [
    ['General', 'सामान्य', 'General', 'Général', 'Geral', 'Allgemein', 'Umum'],
    ['Player', 'प्लेयर', 'Reproductor', 'Lecteur', 'Player', 'Player', 'Pemutar'],
    ['Storage', 'स्टोरेज', 'Almacenamiento', 'Stockage', 'Armazenamento', 'Speicher', 'Penyimpanan'],
    ['Customize', 'कस्टमाइज़', 'Personalizar', 'Personnaliser', 'Personalizar', 'Anpassen', 'Kustomisasi'],
    ['Subtitles', 'सबटाइटल', 'Subtítulos', 'Sous-titres', 'Legendas', 'Untertitel', 'Subjudul'],
    ['Watch stats', 'देखने के आँकड़े', 'Estadísticas', 'Statistiques', 'Estatísticas', 'Statistiken', 'Statistik tontonan'],
    ['App info', 'ऐप जानकारी', 'Info de la app', "Infos de l'app", 'Info do app', 'App-Info', 'Info aplikasi'],
    ['App name, network, animations, UI size', 'ऐप का नाम, नेटवर्क, एनिमेशन, UI आकार', 'Nombre, red, animaciones, tamaño', 'Nom, réseau, animations, taille', 'Nome, rede, animações, tamanho', 'Name, Netzwerk, Animationen, Größe', 'Nama, jaringan, animasi, ukuran'],
    ['Seek step, decoder, performance, fullscreen', 'सीक स्टेप, डिकोडर, परफॉर्मेंस, फुलस्क्रीन', 'Salto, decodificador, rendimiento, pantalla completa', 'Pas, décodeur, performances, plein écran', 'Passo, decodificador, desempenho, tela cheia', 'Sprungweite, Decoder, Leistung, Vollbild', 'Langkah geser, dekoder, performa, layar penuh'],
    ['Saved files, cache, backup', 'सेव फ़ाइलें, कैश, बैकअप', 'Archivos guardados, caché, copia', 'Fichiers, cache, sauvegarde', 'Arquivos salvos, cache, backup', 'Gespeicherte Dateien, Cache, Sicherung', 'File tersimpan, cache, cadangan'],
    ['Buttons, lists, floating resume', 'बटन, सूचियाँ, तैरता रिज़्यूम', 'Botones, listas, reanudar flotante', 'Boutons, listes, reprise flottante', 'Botões, listas, retomar flutuante', 'Tasten, Listen, schwebendes Fortsetzen', 'Tombol, daftar, lanjut mengambang'],
    ['Offline speech models, online AI', 'ऑफ़लाइन स्पीच मॉडल, ऑनलाइन AI', 'Modelos de voz sin conexión, IA en línea', 'Modèles vocaux hors ligne, IA en ligne', 'Modelos de voz offline, IA online', 'Offline-Sprachmodelle, Online-KI', 'Model suara offline, AI online'],
    ['Time watched, streak, top series', 'देखा गया समय, स्ट्रीक, टॉप सीरीज़', 'Tiempo visto, racha, series top', 'Temps vu, série, top séries', 'Tempo assistido, sequência, top séries', 'Sehzeit, Serie, Top-Serien', 'Waktu menonton, rentetan, serial teratas'],
    ['Version, device, storage folders', 'वर्ज़न, डिवाइस, स्टोरेज फ़ोल्डर', 'Versión, dispositivo, carpetas', 'Version, appareil, dossiers', 'Versão, dispositivo, pastas', 'Version, Gerät, Ordner', 'Versi, perangkat, folder'],
    ['Files', 'फ़ाइलें', 'Archivos', 'Fichiers', 'Arquivos', 'Dateien', 'File'],
    ['Tasks', 'टास्क', 'Tareas', 'Tâches', 'Tarefas', 'Aufgaben', 'Tugas'],
    ['Home', 'होम', 'Inicio', 'Accueil', 'Início', 'Start', 'Beranda'],
    ['Library & Playlists', 'लाइब्रेरी और प्लेलिस्ट', 'Biblioteca y listas', 'Bibliothèque et playlists', 'Biblioteca e playlists', 'Bibliothek & Playlists', 'Pustaka & Playlist'],
    ['History', 'इतिहास', 'Historial', 'Historique', 'Histórico', 'Verlauf', 'Riwayat'],
    ['Clear History', 'इतिहास साफ़ करें', 'Borrar historial', "Effacer l'historique", 'Limpar histórico', 'Verlauf löschen', 'Hapus riwayat'],
    ['Continue watching', 'देखना जारी रखें', 'Seguir viendo', 'Reprendre la lecture', 'Continuar assistindo', 'Weiterschauen', 'Lanjutkan menonton'],
    ['Resume', 'फिर शुरू करें', 'Reanudar', 'Reprendre', 'Retomar', 'Fortsetzen', 'Lanjutkan'],
    ['Pause', 'रोकें', 'Pausa', 'Pause', 'Pausar', 'Pause', 'Jeda'],
    ['Stop', 'बंद करें', 'Detener', 'Arrêter', 'Parar', 'Stopp', 'Berhenti'],
    ['Stop all', 'सब बंद करें', 'Detener todo', 'Tout arrêter', 'Parar tudo', 'Alle stoppen', 'Hentikan semua'],
    ['Clear', 'साफ़ करें', 'Borrar', 'Effacer', 'Limpar', 'Leeren', 'Hapus'],
    ['Clear all', 'सब साफ़ करें', 'Borrar todo', 'Tout effacer', 'Limpar tudo', 'Alles leeren', 'Hapus semua'],
    ['Save', 'सेव करें', 'Guardar', 'Enregistrer', 'Salvar', 'Speichern', 'Simpan'],
    ['Save preferences', 'सेटिंग सेव करें', 'Guardar preferencias', 'Enregistrer les préférences', 'Salvar preferências', 'Einstellungen speichern', 'Simpan preferensi'],
    ['Reset', 'रीसेट', 'Restablecer', 'Réinitialiser', 'Redefinir', 'Zurücksetzen', 'Atur ulang'],
    ['Remove', 'हटाएँ', 'Quitar', 'Retirer', 'Remover', 'Entfernen', 'Hapus'],
    ['Open', 'खोलें', 'Abrir', 'Ouvrir', 'Abrir', 'Öffnen', 'Buka'],
    ['Back', 'वापस', 'Atrás', 'Retour', 'Voltar', 'Zurück', 'Kembali'],
    ['Cancel', 'रद्द करें', 'Cancelar', 'Annuler', 'Cancelar', 'Abbrechen', 'Batal'],
    ['Import', 'इंपोर्ट', 'Importar', 'Importer', 'Importar', 'Importieren', 'Impor'],
    ['Scan', 'स्कैन', 'Escanear', 'Analyser', 'Escanear', 'Scannen', 'Pindai'],
    ['Rescan', 'दोबारा स्कैन', 'Reescanear', 'Réanalyser', 'Reescanear', 'Neu scannen', 'Pindai ulang'],
    ['Generate', 'बनाएँ', 'Generar', 'Générer', 'Gerar', 'Erstellen', 'Buat'],
    ['Make subtitles', 'सबटाइटल बनाएँ', 'Crear subtítulos', 'Créer des sous-titres', 'Criar legendas', 'Untertitel erstellen', 'Buat subjudul'],
    ['Add Subtitle', 'सबटाइटल जोड़ें', 'Añadir subtítulo', 'Ajouter un sous-titre', 'Adicionar legenda', 'Untertitel hinzufügen', 'Tambah subjudul'],
    ['Add subtitle file', 'सबटाइटल फ़ाइल जोड़ें', 'Añadir archivo de subtítulos', 'Ajouter un fichier de sous-titres', 'Adicionar arquivo de legenda', 'Untertitel-Datei hinzufügen', 'Tambah file subjudul'],
    ['Subtitle sync', 'सबटाइटल सिंक', 'Sincronizar subtítulos', 'Synchro des sous-titres', 'Sincronia da legenda', 'Untertitel-Sync', 'Sinkron subjudul'],
    ['Subtitle look', 'सबटाइटल का रूप', 'Aspecto de subtítulos', 'Style des sous-titres', 'Aparência da legenda', 'Untertitel-Stil', 'Tampilan subjudul'],
    ['Audio', 'ऑडियो', 'Audio', 'Audio', 'Áudio', 'Audio', 'Audio'],
    ['Audio sync', 'ऑडियो सिंक', 'Sincronizar audio', 'Synchro audio', 'Sincronia de áudio', 'Audio-Sync', 'Sinkron audio'],
    ['Sleep timer', 'स्लीप टाइमर', 'Temporizador', 'Minuterie de veille', 'Timer de sono', 'Schlaftimer', 'Timer tidur'],
    ['Playback speed', 'प्लेबैक स्पीड', 'Velocidad', 'Vitesse de lecture', 'Velocidade', 'Wiedergabegeschwindigkeit', 'Kecepatan putar'],
    ['Equalizer', 'इक्वलाइज़र', 'Ecualizador', 'Égaliseur', 'Equalizador', 'Equalizer', 'Ekualiser'],
    ['Quality', 'क्वालिटी', 'Calidad', 'Qualité', 'Qualidade', 'Qualität', 'Kualitas'],
    ['Filters', 'फ़िल्टर', 'Filtros', 'Filtres', 'Filtros', 'Filter', 'Filter'],
    ['Brightness', 'ब्राइटनेस', 'Brillo', 'Luminosité', 'Brilho', 'Helligkeit', 'Kecerahan'],
    ['Contrast', 'कंट्रास्ट', 'Contraste', 'Contraste', 'Contraste', 'Kontrast', 'Kontras'],
    ['Saturation', 'सैचुरेशन', 'Saturación', 'Saturation', 'Saturação', 'Sättigung', 'Saturasi'],
    ['Sharpness', 'शार्पनेस', 'Nitidez', 'Netteté', 'Nitidez', 'Schärfe', 'Ketajaman'],
    ['Warmth', 'गर्माहट', 'Calidez', 'Chaleur', 'Calor', 'Wärme', 'Kehangatan'],
    ['Seek step', 'सीक स्टेप', 'Salto de búsqueda', 'Pas de saut', 'Passo de busca', 'Sprungweite', 'Langkah geser'],
    ['Video decoder', 'वीडियो डिकोडर', 'Decodificador de video', 'Décodeur vidéo', 'Decodificador de vídeo', 'Video-Decoder', 'Dekoder video'],
    ['Performance', 'परफॉर्मेंस', 'Rendimiento', 'Performances', 'Desempenho', 'Leistung', 'Performa'],
    ['Theme color', 'थीम का रंग', 'Color del tema', 'Couleur du thème', 'Cor do tema', 'Designfarbe', 'Warna tema'],
    ['App name', 'ऐप का नाम', 'Nombre de la app', "Nom de l'app", 'Nome do app', 'App-Name', 'Nama aplikasi'],
    ['Network mode', 'नेटवर्क मोड', 'Modo de red', 'Mode réseau', 'Modo de rede', 'Netzwerkmodus', 'Mode jaringan'],
    ['Offline (Default)', 'ऑफ़लाइन (डिफ़ॉल्ट)', 'Sin conexión (predeterminado)', 'Hors ligne (par défaut)', 'Offline (padrão)', 'Offline (Standard)', 'Offline (default)'],
    ['Online', 'ऑनलाइन', 'En línea', 'En ligne', 'Online', 'Online', 'Online'],
    ['Show thumbnails', 'थंबनेल दिखाएँ', 'Mostrar miniaturas', 'Afficher les miniatures', 'Mostrar miniaturas', 'Vorschaubilder anzeigen', 'Tampilkan thumbnail'],
    ['Low-memory mode', 'कम-मेमोरी मोड', 'Modo de poca memoria', 'Mode faible mémoire', 'Modo pouca memória', 'Speicherspar-Modus', 'Mode hemat memori'],
    ['Animations', 'एनिमेशन', 'Animaciones', 'Animations', 'Animações', 'Animationen', 'Animasi'],
    ['UI size', 'UI का आकार', 'Tamaño de la interfaz', "Taille de l'interface", 'Tamanho da interface', 'UI-Größe', 'Ukuran UI'],
    ['Home screen shortcuts', 'होम स्क्रीन शॉर्टकट', 'Accesos directos', "Raccourcis écran d'accueil", 'Atalhos na tela inicial', 'Startbildschirm-Verknüpfungen', 'Pintasan layar utama'],
    ['Auto', 'ऑटो', 'Automático', 'Auto', 'Auto', 'Auto', 'Otomatis'],
    ['On', 'चालू', 'Activado', 'Activé', 'Ativado', 'An', 'Aktif'],
    ['Off', 'बंद', 'Desactivado', 'Désactivé', 'Desativado', 'Aus', 'Mati'],
    ['Default', 'डिफ़ॉल्ट', 'Predeterminado', 'Par défaut', 'Padrão', 'Standard', 'Default'],
    ['None', 'कोई नहीं', 'Ninguno', 'Aucun', 'Nenhum', 'Keine', 'Tidak ada'],
    ['All', 'सभी', 'Todo', 'Tout', 'Tudo', 'Alle', 'Semua'],
    ['Episodes', 'एपिसोड', 'Episodios', 'Épisodes', 'Episódios', 'Folgen', 'Episode'],
    ['Episode List', 'एपिसोड सूची', 'Lista de episodios', 'Liste des épisodes', 'Lista de episódios', 'Folgenliste', 'Daftar episode'],
    ['Next', 'अगला', 'Siguiente', 'Suivant', 'Próximo', 'Weiter', 'Berikutnya'],
    ['Previous', 'पिछला', 'Anterior', 'Précédent', 'Anterior', 'Zurück', 'Sebelumnya'],
    ['Next Ep', 'अगला एपिसोड', 'Sig. ep.', 'Ép. suiv.', 'Próx. ep.', 'Nächste Folge', 'Ep. berikut'],
    ['Playlists', 'प्लेलिस्ट', 'Listas', 'Playlists', 'Playlists', 'Playlists', 'Playlist'],
    ['Loading...', 'लोड हो रहा है...', 'Cargando...', 'Chargement...', 'Carregando...', 'Laden...', 'Memuat...'],
    ['Active', 'सक्रिय', 'Activas', 'Actives', 'Ativas', 'Aktiv', 'Aktif'],
    ['Completed', 'पूरा हुआ', 'Completadas', 'Terminées', 'Concluídas', 'Abgeschlossen', 'Selesai'],
    ['Failed', 'विफल', 'Fallidas', 'Échouées', 'Falharam', 'Fehlgeschlagen', 'Gagal'],
    ['Canceled', 'रद्द', 'Canceladas', 'Annulées', 'Canceladas', 'Abgebrochen', 'Dibatalkan'],
    ['Paused', 'रुका हुआ', 'En pausa', 'En pause', 'Pausadas', 'Pausiert', 'Dijeda'],
    ['Backup', 'बैकअप', 'Copia de seguridad', 'Sauvegarde', 'Backup', 'Sicherung', 'Cadangan'],
    ['Back up now', 'अभी बैकअप लें', 'Respaldar ahora', 'Sauvegarder maintenant', 'Fazer backup agora', 'Jetzt sichern', 'Cadangkan sekarang'],
    ['Restore from file', 'फ़ाइल से रिस्टोर करें', 'Restaurar desde archivo', 'Restaurer depuis un fichier', 'Restaurar do arquivo', 'Aus Datei wiederherstellen', 'Pulihkan dari file'],
    ['Updates', 'अपडेट', 'Actualizaciones', 'Mises à jour', 'Atualizações', 'Updates', 'Pembaruan'],
    ['Support the developer', 'डेवलपर को सपोर्ट करें', 'Apoya al desarrollador', 'Soutenir le développeur', 'Apoie o desenvolvedor', 'Entwickler unterstützen', 'Dukung pengembang'],
    ['Buy me a coffee', 'मुझे कॉफ़ी पिलाएँ', 'Invítame un café', 'Offrez-moi un café', 'Me pague um café', 'Spendier mir einen Kaffee', 'Traktir kopi'],
    ['Language', 'भाषा', 'Idioma', 'Langue', 'Idioma', 'Sprache', 'Bahasa'],
    ['Menus and labels. Video names, subtitles and some messages stay as they are.', 'मेन्यू और लेबल। वीडियो के नाम, सबटाइटल और कुछ संदेश वैसे ही रहते हैं।', 'Menús y etiquetas. Los nombres de videos, subtítulos y algunos mensajes no cambian.', 'Menus et libellés. Les noms de vidéos, les sous-titres et certains messages ne changent pas.', 'Menus e rótulos. Nomes de vídeos, legendas e algumas mensagens não mudam.', 'Menüs und Beschriftungen. Videonamen, Untertitel und einige Meldungen bleiben unverändert.', 'Menu dan label. Nama video, subjudul, dan beberapa pesan tidak berubah.']
  ];
  const codes = LANGS.map((l) => l[0]);
  const dict = {}; // lang -> lowercased English -> translation
  codes.slice(1).forEach((c, i) => { const d = dict[c] = {}; ROWS.forEach((r) => { d[r[0].toLowerCase()] = r[i + 1]; }); });
  let lang = 'en'; try { lang = localStorage.getItem('astra_lang') || 'en'; } catch (e) {}
  if (!dict[lang]) lang = 'en';

  const recs = new WeakMap(); // text node / element -> { o: original, t: what we wrote }
  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-label'];
  const tr = (s) => {
    const d = dict[lang]; if (!d) return null;
    const k = s.trim().replace(/\s+/g, ' ').toLowerCase(); const v = d[k]; if (!v) return null;
    const up = s === s.toUpperCase() && /[A-Z]/.test(s);
    return up ? v.toUpperCase() : v;
  };
  const skip = (el) => !el || el.closest && el.closest('script,style,textarea,[data-i18n-skip]');
  function doText(n) {
    const rec = recs.get(n); const cur = n.data;
    const o = rec && rec.t === cur ? rec.o : cur;
    const v = lang === 'en' ? null : tr(o);
    if (v) { const lead = o.match(/^\s*/)[0], trail = o.match(/\s*$/)[0]; const t = lead + v + trail; if (cur !== t) n.data = t; recs.set(n, { o, t }); }
    else if (rec) { if (rec.t === cur && cur !== rec.o) n.data = rec.o; recs.delete(n); }
  }
  function doAttrs(el) {
    ATTRS.forEach((a) => {
      const cur = el.getAttribute && el.getAttribute(a); if (!cur) return;
      const key = recs.get(el) || {}; const rec = key[a];
      const o = rec && rec.t === cur ? rec.o : cur;
      const v = lang === 'en' ? null : tr(o);
      if (v) { if (cur !== v) el.setAttribute(a, v); key[a] = { o, t: v }; recs.set(el, key); }
      else if (rec) { if (rec.t === cur) el.setAttribute(a, rec.o); delete key[a]; }
    });
  }
  let busy = false;
  function apply(root) {
    if (busy) return; busy = true;
    try {
      root = root || document.body;
      if (root.nodeType === 3) { if (!skip(root.parentElement)) doText(root); return; }
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n = w.currentNode;
      while (n) {
        if (n.nodeType === 3) { if (n.data.trim() && !skip(n.parentElement)) doText(n); }
        else if (n.nodeType === 1 && !skip(n)) doAttrs(n);
        n = w.nextNode();
      }
    } finally { busy = false; }
  }
  let queued = new Set(), raf = 0;
  const flush = () => { raf = 0; const q = queued; queued = new Set(); q.forEach((n) => { if (n.isConnected) apply(n); }); };
  const mo = new MutationObserver((ms) => {
    if (busy) return;
    ms.forEach((m) => {
      if (m.type === 'characterData') queued.add(m.target);
      else if (m.type === 'attributes') queued.add(m.target);
      else m.addedNodes.forEach((n) => queued.add(n));
    });
    if (!raf) raf = requestAnimationFrame(flush);
  });
  function observe() { mo.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS }); }

  function resyncSelects() { document.querySelectorAll('select').forEach((s) => { if (s._cs) { try { s.value = s.value; } catch (e) {} } }); }
  function setLang(c) {
    if (!dict[c] && c !== 'en') return; lang = c;
    try { localStorage.setItem('astra_lang', c); } catch (e) {}
    document.documentElement.lang = c;
    apply(); resyncSelects(); apply();
  }
  window.astraLang = { get: () => lang, set: setLang, list: LANGS };

  function init() {
    const sel = document.getElementById('prefLang');
    if (sel) {
      sel.innerHTML = LANGS.map((l) => '<option value="' + l[0] + '">' + l[1] + '</option>').join('');
      sel.value = lang;
      sel.addEventListener('change', () => setLang(sel.value));
    }
    document.documentElement.lang = lang;
    observe();
    if (lang !== 'en') { apply(); setTimeout(() => { resyncSelects(); apply(); }, 300); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
