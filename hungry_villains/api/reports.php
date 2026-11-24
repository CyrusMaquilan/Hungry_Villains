<?php
require_once __DIR__ . "/session_guard.php";
header("Content-Type: application/json; charset=UTF-8");
include_once 'db.php';
include_once 'admin_auth.php';
require_admin($pdo);
date_default_timezone_set('Asia/Manila');

function is_valid_report_date($date) {
    if (!is_string($date)) {
        return false;
    }

    $parsedDate = DateTime::createFromFormat('!Y-m-d', $date);
    return $parsedDate && $parsedDate->format('Y-m-d') === $date;
}

$startDate = isset($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
$endDate = isset($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');
if (!is_valid_report_date($startDate) || !is_valid_report_date($endDate) || $startDate > $endDate) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Choose a valid date range."]);
    exit;
}

try {
    $endExclusive = (new DateTime($endDate))->modify('+1 day')->format('Y-m-d');
    $stmt = $pdo->prepare(
        "SELECT id, created_at, total_price, status, items
         FROM orders
         WHERE created_at >= :start_date AND created_at < :end_date
         ORDER BY created_at ASC, id ASC"
    );
    $stmt->execute([
        'start_date' => $startDate,
        'end_date' => $endExclusive
    ]);

    $totals = [
        'transaction_count' => 0,
        'completed_count' => 0,
        'open_count' => 0,
        'items_sold' => 0,
        'gross_sales' => 0.0,
        'completed_sales' => 0.0,
        'open_sales' => 0.0
    ];
    $dailySales = [];
    $productSales = [];

    while ($transaction = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $items = json_decode($transaction['items'], true);
        if (!is_array($items)) {
            throw new UnexpectedValueException("Invalid item data for transaction #" . $transaction['id']);
        }

        $status = $transaction['status'] ?: 'Pending';
        $amount = (float)$transaction['total_price'];
        $day = substr($transaction['created_at'], 0, 10);
        $totals['transaction_count']++;
        $totals['gross_sales'] += $amount;

        if ($status === 'Completed') {
            $totals['completed_count']++;
            $totals['completed_sales'] += $amount;
        } else {
            $totals['open_count']++;
            $totals['open_sales'] += $amount;
        }

        if (!isset($dailySales[$day])) {
            $dailySales[$day] = ['date' => $day, 'transactions' => 0, 'sales' => 0.0];
        }
        $dailySales[$day]['transactions']++;
        $dailySales[$day]['sales'] += $amount;

        foreach ($items as $item) {
            $name = isset($item['name']) ? trim((string)$item['name']) : '';
            $quantity = isset($item['quantity']) ? filter_var($item['quantity'], FILTER_VALIDATE_INT) : false;
            if ($name === '' || $quantity === false || $quantity < 1) {
                continue;
            }

            $price = isset($item['price']) && is_numeric($item['price']) ? (float)$item['price'] : 0.0;
            $totals['items_sold'] += $quantity;
            if (!isset($productSales[$name])) {
                $productSales[$name] = ['name' => $name, 'quantity' => 0, 'sales' => 0.0];
            }
            $productSales[$name]['quantity'] += $quantity;
            $productSales[$name]['sales'] += $price * $quantity;
        }
    }

    $dailySales = array_values($dailySales);
    $productSales = array_values($productSales);
    usort($productSales, function ($left, $right) {
        return $right['quantity'] <=> $left['quantity'];
    });

    echo json_encode([
        "success" => true,
        "start_date" => $startDate,
        "end_date" => $endDate,
        "totals" => $totals,
        "daily_sales" => $dailySales,
        "product_sales" => array_slice($productSales, 0, 10)
    ]);
} catch (PDOException $error) {
    error_log("Sales report query failed: " . $error->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Unable to load sales reports."]);
} catch (UnexpectedValueException $error) {
    error_log("Sales report data error: " . $error->getMessage());
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Sales report contains invalid transaction data."]);
}
?>
