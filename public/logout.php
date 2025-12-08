<?php
session_start();
$_SESSION = [];
session_destroy();

// Remove cookie de remember
setcookie('remember_me', '', [
    'expires' => time() - 3600,
    'path' => '/',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax',
]);
?><!DOCTYPE html>
<html>
<head>
    <title>Saindo...</title>
    <script>
        // Limpa o localStorage para deslogar
        localStorage.removeItem('keepLoggedIn');
        // Redireciona imediatamente para a página de login
        window.location.href = 'login.php';
    </script>
</head>
<body></body>
</html>
