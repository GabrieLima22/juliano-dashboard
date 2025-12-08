<?php
session_start();

$rememberSecret = 'jml-remember-2025';
$rememberHash = hash_hmac('sha256', 'diretoria', $rememberSecret);

// Se ainda nao houver sessao mas existir cookie valido, recria a sessao
if (!isset($_SESSION['loggedin']) && isset($_COOKIE['remember_me']) && hash_equals($rememberHash, (string)$_COOKIE['remember_me'])) {
    $_SESSION['loggedin'] = true;
    $_SESSION['username'] = 'diretoria';
}

// Se o usuario ja estiver logado na sessao, redireciona para o dashboard
if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true) {
    header('Location: index.php');
    exit;
}

$error = '';
$keep_logged_in = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    // Credenciais hardcoded
    if ($username === 'diretoria' && $password === '14133') {
        $_SESSION['loggedin'] = true;
        $_SESSION['username'] = $username;

        if (isset($_POST['keep_logged_in'])) {
            // Sinaliza para o JavaScript e seta cookie de remember
            $keep_logged_in = true;
            setcookie('remember_me', $rememberHash, [
                'expires' => time() + (60 * 60 * 24 * 30), // 30 dias
                'path' => '/',
                'secure' => false,
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        } else {
            // Se nao quiser continuar logado, limpa storage e cookie
            setcookie('remember_me', '', [
                'expires' => time() - 3600,
                'path' => '/',
                'secure' => false,
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            echo "<script>localStorage.removeItem('keepLoggedIn');</script>";
        }
        // O redirecionamento sera feito via JavaScript para dar tempo de executar o script
    } else {
        $error = 'Usuario ou senha invalidos.';
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/login.css">
    <script>
        // Checa o localStorage assim que a pagina carrega, mas so tenta pular se ainda houver sessao
        (function () {
            const wantsKeep = localStorage.getItem('keepLoggedIn') === 'true';
            const hasSessionCookie = document.cookie.split(';').some(c => c.trim().startsWith('PHPSESSID='));
            if (wantsKeep && (hasSessionCookie || document.cookie.split(';').some(c => c.trim().startsWith('remember_me=')))) {
                window.location.href = 'index.php';
            }
        }());
    </script>
</head>
<body>
    <div class="background-effects">
        <div class="background-blob blob-purple"></div>
        <div class="background-blob blob-blue"></div>
        <div class="background-blob blob-green"></div>
    </div>
    <div class="login-page">
        <div class="login-image-side" style="background-image: url('assets/CEOjml3.jpg');">
            <!-- A imagem e um fundo de CSS para melhor controle -->
        </div>
        <div class="login-form-side">
            <div class="form-wrapper">
                <h2>Bem-vindo de volta</h2>
                <p>Acesse o seu dashboard.</p>
                <form id="loginForm" action="login.php" method="post">
                    <div class="input-group">
                        <label for="username">Usuario</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="input-group">
                        <label for="password">Senha</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <div class="keep-logged-in">
                        <input type="checkbox" id="keep_logged_in" name="keep_logged_in">
                        <label for="keep_logged_in">Continuar logado</label>
                    </div>
                    <?php if ($error): ?>
                        <p class="error-message"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
                    <?php endif; ?>
                    <button type="submit">Entrar</button>
                </form>
            </div>
        </div>
    </div>

    <?php if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($error)): ?>
    <script>
        // Se o login foi bem-sucedido, o PHP define $keep_logged_in
        const keepLoggedIn = <?php echo json_encode($keep_logged_in); ?>;
        if (keepLoggedIn) {
            localStorage.setItem('keepLoggedIn', 'true');
        } else {
            localStorage.removeItem('keepLoggedIn');
        }
        // Aplica animação de saída e redireciona
        document.body.classList.add('page-exit');
        setTimeout(() => {
            window.location.href = 'index.php';
        }, 400);
    </script>
    <?php endif; ?>

    <script>
        // Adiciona animação suave ao submeter o formulário
        document.getElementById('loginForm')?.addEventListener('submit', function() {
            document.body.classList.add('page-exit');
        });
    </script>

</body>
</html>
