<?php
function save_product_image($imageData) {
    if ($imageData === null || $imageData === '') {
        return null;
    }

    if (!is_string($imageData) || strlen($imageData) > 3 * 1024 * 1024 ||
        !preg_match('#^data:(image/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$#D', $imageData, $matches)) {
        throw new RuntimeException("Choose a valid JPG, PNG, WEBP, or GIF image no larger than 2 MB.");
    }

    $imageContents = base64_decode($matches[2], true);
    if ($imageContents === false || strlen($imageContents) > 2 * 1024 * 1024) {
        throw new RuntimeException("Product images must be 2 MB or smaller.");
    }

    $imageInfo = getimagesizefromstring($imageContents);
    if ($imageInfo === false || $imageInfo['mime'] !== $matches[1]) {
        throw new RuntimeException("The selected file is not a valid image.");
    }

    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif'
    ];
    $filename = 'product_' . bin2hex(random_bytes(12)) . '.' . $extensions[$imageInfo['mime']];
    $imageDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'pictures';
    $imagePath = $imageDirectory . DIRECTORY_SEPARATOR . $filename;

    if (file_put_contents($imagePath, $imageContents, LOCK_EX) === false) {
        throw new RuntimeException("Unable to save the product image. Check the pictures folder permissions.");
    }

    return 'pictures/' . $filename;
}
?>
