const axios = require('axios');

async function run() {
    const apiUrl = 'https://glpi.innerworks.com.br/api.php/v1';
    const apiToken = 'GONXUoJOJWsHwAPF6QS6lKMXJbCQLDalNWCFR7dU';
    const userToken = 'SKq5rsuVL2BGdQEmSdU1Q0PTIJoSF0AaQHhk1CbZ';

    const init = await axios.get(apiUrl + '/initSession', {
        headers: { 'App-Token': apiToken, 'Authorization': 'user_token ' + userToken }
    });
    const sessionToken = init.data.session_token;

    const res = await axios.get(apiUrl + '/Entity?expand_dropdowns=true&range=0-200', {
        headers: { 'App-Token': apiToken, 'Session-Token': sessionToken }
    });

    const entities = res.data.map(e => ({ id: e.id, name: e.completename || e.name }));
    const carpolog = entities.filter(e => e.name.toLowerCase().includes('carpolog'));

    console.log("Resultado da Busca por 'carpolog':");
    console.log(carpolog);

    // Salvar todas em um arquivo pra referência
    const fs = require('fs');
    fs.writeFileSync('entidades.json', JSON.stringify(entities, null, 2));
    console.log('Todas as entidades foram salvas em entidades.json');
}

run().catch(e => console.error(e.response ? e.response.data : e.message));
