import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/theme/app_theme.dart';

class SearchRidesScreen extends StatefulWidget {
  const SearchRidesScreen({super.key});

  @override
  State<SearchRidesScreen> createState() => _SearchRidesScreenState();
}

class _SearchRidesScreenState extends State<SearchRidesScreen> {
  final _originCtrl = TextEditingController();
  final _destinationCtrl = TextEditingController();
  DateTime? _date;
  int _seats = 1;
  bool _searching = false;
  List<QueryDocumentSnapshot<Map<String, dynamic>>> _results = [];
  bool _hasSearched = false;

  @override
  void dispose() {
    _originCtrl.dispose();
    _destinationCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 14)),
    );
    if (d != null) setState(() => _date = d);
  }

  Future<void> _search() async {
    setState(() {
      _searching = true;
      _results = [];
      _hasSearched = true;
    });

    try {
      Query<Map<String, dynamic>> q = FirebaseFirestore.instance
          .collection('scheduled_rides')
          .where('status', isEqualTo: 'published')
          .where('availableSeats', isGreaterThanOrEqualTo: _seats);

      // Filtre par date (si sélectionnée)
      if (_date != null) {
        final startOfDay = DateTime(_date!.year, _date!.month, _date!.day);
        final endOfDay = startOfDay.add(const Duration(days: 1));
        q = q
            .where('departureAt', isGreaterThanOrEqualTo: startOfDay)
            .where('departureAt', isLessThan: endOfDay);
      } else {
        // Seulement les trajets futurs
        q = q.where('departureAt', isGreaterThan: DateTime.now());
      }

      q = q.orderBy('departureAt').limit(30);
      final snap = await q.get();

      // Filtre textuel côté client (Firestore ne supporte pas LIKE)
      final origin = _originCtrl.text.trim().toLowerCase();
      final destination = _destinationCtrl.text.trim().toLowerCase();

      final filtered = snap.docs.where((doc) {
        final data = doc.data();
        final orig = (data['originAddress'] as String? ?? '').toLowerCase();
        final dest = (data['destinationAddress'] as String? ?? '').toLowerCase();
        final matchOrigin = origin.isEmpty || orig.contains(origin);
        final matchDest = destination.isEmpty || dest.contains(destination);
        return matchOrigin && matchDest;
      }).toList();

      setState(() {
        _results = filtered;
        _searching = false;
      });
    } catch (e) {
      setState(() => _searching = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Trouver un trajet')),
      body: Column(
        children: [
          // ── Formulaire de recherche ───────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            color: colorScheme.surface,
            child: Column(
              children: [
                TextFormField(
                  controller: _originCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Départ',
                    prefixIcon:
                        Icon(Icons.circle_rounded, color: Colors.green, size: 14),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _destinationCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Arrivée',
                    prefixIcon: Icon(Icons.location_on_rounded,
                        color: VoyajColors.primary, size: 14),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(Icons.calendar_today_rounded, size: 16),
                        label: Text(_date == null
                            ? 'Date'
                            : '${_date!.day}/${_date!.month}'),
                        style: OutlinedButton.styleFrom(
                            padding:
                                const EdgeInsets.symmetric(vertical: 8)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Row(
                      children: [
                        IconButton(
                          onPressed: _seats > 1
                              ? () => setState(() => _seats--)
                              : null,
                          icon: const Icon(Icons.remove_circle_outline_rounded,
                              size: 20),
                          visualDensity: VisualDensity.compact,
                        ),
                        Text('$_seats place${_seats > 1 ? 's' : ''}',
                            style: theme.textTheme.labelMedium),
                        IconButton(
                          onPressed: _seats < 7
                              ? () => setState(() => _seats++)
                              : null,
                          icon: const Icon(Icons.add_circle_outline_rounded,
                              size: 20),
                          visualDensity: VisualDensity.compact,
                        ),
                      ],
                    ),
                    FilledButton(
                      onPressed: _searching ? null : _search,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        backgroundColor: VoyajColors.primary,
                      ),
                      child: _searching
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Chercher'),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── Résultats ─────────────────────────────────────────────────
          Expanded(
            child: _searching
                ? const Center(child: CircularProgressIndicator())
                : !_hasSearched
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_rounded,
                                size: 56,
                                color: colorScheme.onSurfaceVariant),
                            const SizedBox(height: 12),
                            Text(
                              'Saisissez votre trajet et lancez la recherche',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                  color: colorScheme.onSurfaceVariant),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      )
                    : _results.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.sentiment_dissatisfied_rounded,
                                    size: 56,
                                    color: colorScheme.onSurfaceVariant),
                                const SizedBox(height: 12),
                                Text(
                                  'Aucun trajet trouvé',
                                  style: theme.textTheme.bodyLarge?.copyWith(
                                      color: colorScheme.onSurfaceVariant),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Essayez d\'autres critères ou publiez une demande',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                      color: colorScheme.onSurfaceVariant),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _results.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final doc = _results[index];
                              final ride = doc.data();
                              return _RideResultCard(
                                rideId: doc.id,
                                ride: ride,
                                onTap: () =>
                                    context.push('/scheduled/${doc.id}/book'),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _RideResultCard extends StatelessWidget {
  final String rideId;
  final Map<String, dynamic> ride;
  final VoidCallback onTap;

  const _RideResultCard({
    required this.rideId,
    required this.ride,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final price =
        (ride['priceBreakdown']?['passengerTotalEur'] as num?)?.toDouble() ?? 0.0;
    final availSeats =
        (ride['seats'] as int? ?? 0) - (ride['bookedSeats'] as int? ?? 0);

    final departureAt = ride['departureAt'];
    String dateStr = '—';
    if (departureAt is Timestamp) {
      final d = departureAt.toDate();
      dateStr = '${d.day}/${d.month} à ${d.hour.toString().padLeft(2, '0')}h${d.minute.toString().padLeft(2, '0')}';
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colorScheme.outlineVariant),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  dateStr,
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: colorScheme.onSurfaceVariant),
                ),
                const Spacer(),
                Text(
                  '${price.toStringAsFixed(2)} €',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: VoyajColors.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.circle_rounded, size: 8, color: Colors.green),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    ride['originAddress'] ?? '—',
                    style: theme.textTheme.bodySmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_rounded,
                    size: 8, color: VoyajColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    ride['destinationAddress'] ?? '—',
                    style: theme.textTheme.bodySmall,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.event_seat_rounded,
                    size: 14, color: colorScheme.onSurfaceVariant),
                const SizedBox(width: 4),
                Text(
                  '$availSeats place${availSeats != 1 ? 's' : ''} disponible${availSeats != 1 ? 's' : ''}',
                  style: theme.textTheme.labelSmall
                      ?.copyWith(color: colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
